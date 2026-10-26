// Typed Supabase queries for passage generation and reading (tables in supabase/schema.sql).
import type { PassageQuestion } from '../ai/prompts';
import { freshSince, type ReadyPassage } from '../passage/buffer';
import type { CheckedPassage, CheckedSentence } from '../passage/generate-passage';
import type { LearnerItem, PassageRequest } from '../passage/request';
import { supabase } from './supabase';

/** passages.content: the checked passage, with tokens so reading needs no tokenizer round-trip. */
export interface PassageContent {
	title: string;
	/** `keys` is missing on passages saved before grading existed. */
	sentences: (Omit<CheckedSentence, 'keys'> & Partial<Pick<CheckedSentence, 'keys'>>)[];
	used_grammar: string[];
	questions: PassageQuestion[];
}

/** passages.target_items: what the passage was built around, for grading it later. */
export interface TargetItems {
	grammar: string[];
	words: string[];
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

export async function loadLearnerState(): Promise<{ items: LearnerItem[]; completedLessons: string[] }> {
	const [items, lessons] = await Promise.all([
		allItems<LearnerItem>('item_type, item_key, status, due'),
		supabase.from('lesson_progress').select('lesson_id').not('completed_at', 'is', null)
	]);
	if (lessons.error) throw new Error(`Loading lesson progress failed: ${lessons.error.message}`);
	return { items, completedLessons: lessons.data.map((l) => l.lesson_id as string) };
}

/** Kanji marked known (furigana is shown only on the rest). */
export async function loadKnownKanji(): Promise<Set<string>> {
	const rows = await allItems<{ item_key: string }>('item_key', (q) => q.eq('item_type', 'kanji').eq('status', 'known'));
	return new Set(rows.map((r) => r.item_key));
}

/** Save a generated passage as ready to read; returns its id. */
export async function savePassage(request: PassageRequest, passage: CheckedPassage): Promise<string> {
	const content: PassageContent = {
		title: passage.draft.title,
		sentences: passage.sentences,
		used_grammar: passage.draft.used_grammar,
		questions: passage.draft.questions
	};
	const target_items: TargetItems = { grammar: request.targetGrammar.map((p) => p.id), words: request.dueWords };
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
