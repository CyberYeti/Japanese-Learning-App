// Typed Supabase queries for passage generation and reading (tables in supabase/schema.sql).
import type { PassageQuestion } from '../ai/prompts';
import { freshSince, type ReadyPassage } from '../passage/buffer';
import type { CheckedPassage, CheckedSentence } from '../passage/generate-passage';
import type { LearnerItem, PassageFormat, PassageRequest } from '../passage/request';
import { kanjiKnowledge, type KanjiKnowledge, type KanjiRow } from '../srs/kanji';
import { supabase } from './supabase';

/** passages.content: the checked passage, with tokens so reading needs no tokenizer round-trip. */
export interface PassageContent {
	title: string;
	/** `keys` is missing on passages saved before grading existed. */
	sentences: (Omit<CheckedSentence, 'keys'> & Partial<Pick<CheckedSentence, 'keys'>>)[];
	used_grammar: string[];
	questions: PassageQuestion[];
	/** JLPT words this passage introduces, highlighted with their gloss; missing on older passages. */
	new_words?: NewWordGloss[];
}

export interface NewWordGloss {
	key: string;
	/** The key and its aliases: every vocab key the word can be tokenized as. */
	spellings: string[];
	kanji: string | null;
	kana: string;
	gloss: string;
}

/** passages.target_items: what the passage was built around, for grading it later. */
export interface TargetItems {
	grammar: string[];
	words: string[];
	/** Vocab keys of the new words introduced; missing on older passages. */
	new?: string[];
}

export interface StoredPassage {
	id: string;
	created_at: string;
	status: 'ready' | 'read';
	lesson_id: string | null;
	topic: string | null;
	format: 'prose' | 'dialogue' | null;
	content: PassageContent;
	target_items: TargetItems;
	coverage: number;
}

// PostgREST caps a response at 1000 rows by default; vocab grows past that.
const PAGE = 1000;

type ItemQuery = ReturnType<ReturnType<typeof supabase.from>['select']>;

/** Every `items` row the query selects, fetched a page at a time in key order. */
async function allItems<T>(columns: string, filter: (q: ItemQuery) => ItemQuery = (q) => q): Promise<T[]> {
	const rows: T[] = [];
	for (let from = 0; ; from += PAGE) {
		const { data, error } = await filter(supabase.from('items').select(columns))
			.order('item_type')
			.order('item_key')
			.range(from, from + PAGE - 1);
		if (error) throw new Error(`Loading items failed: ${error.message}`);
		rows.push(...(data as T[]));
		if (data.length < PAGE) return rows;
	}
}

export interface LearnerState {
	items: LearnerItem[];
	completedLessons: string[];
	/** Format of the newest passage, so the next one alternates; null before the first. */
	lastFormat: PassageFormat | null;
}

export async function loadLearnerState(): Promise<LearnerState> {
	const [items, lessons, last] = await Promise.all([
		allItems<LearnerItem>('item_type, item_key, status, due, source_lesson, introduced_at'),
		supabase.from('lesson_progress').select('lesson_id').not('completed_at', 'is', null),
		supabase.from('passages').select('format').order('created_at', { ascending: false }).limit(1).maybeSingle()
	]);
	if (lessons.error) throw new Error(`Loading lesson progress failed: ${lessons.error.message}`);
	if (last.error) throw new Error(`Loading passages failed: ${last.error.message}`);
	return {
		items,
		completedLessons: lessons.data.map((l) => l.lesson_id as string),
		lastFormat: (last.data?.format as PassageFormat | null | undefined) ?? null
	};
}

/**
 * Which kanji are known (furigana is shown only on the rest): those in at least `threshold` known
 * words, plus or minus the ones set by hand (SPEC §5.1).
 */
export async function loadKanjiKnowledge(threshold: number): Promise<KanjiKnowledge> {
	const [words, overrides] = await Promise.all([
		allItems<{ item_key: string }>('item_key', (q) => q.eq('item_type', 'word').eq('status', 'known')),
		allItems<{ item_key: string; status: string }>('item_key, status', (q) =>
			q.eq('item_type', 'kanji').eq('manual_override', true)
		)
	]);
	return kanjiKnowledge(
		words.map((w) => w.item_key),
		overrides.map((o) => ({ kanji: o.item_key, known: o.status === 'known' })),
		threshold
	);
}

/** Save a kanji's status after a tap. */
export async function saveKanji(row: KanjiRow): Promise<void> {
	const { error } = await supabase.from('items').upsert(row, { onConflict: 'user_id,item_type,item_key' });
	if (error) throw new Error(`Saving the kanji failed: ${error.message}`);
}

/**
 * Add the new words a passage introduces as learning items, due now (SPEC §5.2). source_lesson stays
 * null, which is how they count towards daily_new_words. Words already present are left alone.
 */
export async function introduceWords(keys: string[]): Promise<void> {
	if (!keys.length) return;
	const { error } = await supabase
		.from('items')
		.upsert(
			keys.map((item_key) => ({ item_type: 'word', item_key })),
			{ onConflict: 'user_id,item_type,item_key', ignoreDuplicates: true }
		);
	if (error) throw new Error(`Adding the passage's new words failed: ${error.message}`);
}

/** Save a generated passage as ready to read; returns its id. */
export async function savePassage(request: PassageRequest, passage: CheckedPassage): Promise<string> {
	const content: PassageContent = {
		title: passage.draft.title,
		sentences: passage.sentences,
		used_grammar: passage.draft.used_grammar,
		questions: passage.draft.questions,
		new_words: request.newWords
			.filter((w) => passage.newWords.includes(w.key))
			.map((w) => ({ key: w.key, spellings: [w.key, ...w.aliases], kanji: w.kanji, kana: w.kana, gloss: w.gloss }))
	};
	const target_items: TargetItems = {
		grammar: request.targetGrammar.map((p) => p.id),
		words: request.dueWords,
		new: passage.newWords
	};
	const { data, error } = await supabase
		.from('passages')
		.insert({
			status: 'ready',
			lesson_id: request.lessonId,
			topic: request.topic,
			format: request.format,
			content,
			target_items,
			coverage: passage.coverage
		})
		.select('id')
		.single();
	if (error) throw new Error(`Saving the passage failed: ${error.message}`);
	return data.id as string;
}

export async function loadPassage(id: string): Promise<StoredPassage | null> {
	const { data, error } = await supabase.from('passages').select('*').eq('id', id).maybeSingle();
	if (error) throw new Error(`Loading the passage failed: ${error.message}`);
	return data as StoredPassage | null;
}

/** Every passage not yet read, expired or not. */
export async function loadReadyPassages(): Promise<ReadyPassage[]> {
	const { data, error } = await supabase.from('passages').select('id, created_at').eq('status', 'ready');
	if (error) throw new Error(`Loading passages failed: ${error.message}`);
	return data as ReadyPassage[];
}

/** Delete passages that are still unread; one read meanwhile is kept, since reviews point at it. */
export async function deleteReadyPassages(ids: string[]): Promise<void> {
	const { error } = await supabase.from('passages').delete().in('id', ids).eq('status', 'ready');
	if (error) throw new Error(`Deleting expired passages failed: ${error.message}`);
}

/** The oldest unread passage that hasn't expired, if any; oldest first, so it's read before it expires. */
export async function loadNextReadyPassageId(now: Date): Promise<string | null> {
	const { data, error } = await supabase
		.from('passages')
		.select('id')
		.eq('status', 'ready')
		.gte('created_at', freshSince(now).toISOString())
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();
	if (error) throw new Error(`Loading passages failed: ${error.message}`);
	return (data?.id as string | undefined) ?? null;
}
