// Step 1 of passage generation (SPEC §5.3): what a passage should be built around.
import type { GrammarPoint } from '../nlp/grammar';
import type { Politeness, Settings } from '../settings/settings';
import type { VocabWord } from '../vocab/vocab';

/** The columns of an `items` row that passage building needs. */
export interface LearnerItem {
	item_type: 'word' | 'grammar' | 'kanji';
	item_key: string;
	status: 'learning' | 'known';
	/** ISO timestamp. */
	due: string;
	/** The lesson that introduced it, or null for a JLPT word introduced through a passage. */
	source_lesson: string | null;
	/** ISO timestamp. */
	introduced_at: string;
}

export type PassageFormat = 'prose' | 'dialogue';

export interface PassageRequest {
	/** The lesson whose grammar the passage practises, or null before any lesson is completed. */
	lessonId: string | null;
	targetGrammar: GrammarPoint[];
	/** Vocab keys of due words the passage should use. */
	dueWords: string[];
	/** Vocab keys (with aliases) of every learning or known word. */
	allowedWords: Set<string>;
	/** JLPT words not yet introduced that the passage may introduce (SPEC §5.2). */
	newWords: VocabWord[];
	topic: string;
	format: PassageFormat;
	politeness: Politeness;
	sentenceCount: number;
}

export interface RequestInput {
	items: LearnerItem[];
	/** Ids of lessons with completed_at set. */
	completedLessons: string[];
	lessons: { id: string; order: number }[];
	grammarPoints: GrammarPoint[];
	vocab: VocabWord[];
	settings: Pick<Settings, 'interest_tags' | 'politeness' | 'daily_new_words'>;
	/** Format of the most recently generated passage, so formats alternate; null before the first. */
	lastFormat: PassageFormat | null;
	/** Start of the learner's day: JLPT words introduced since then count towards daily_new_words. */
	dayStart: Date;
	now: Date;
	random?: () => number;
}

const MAX_DUE_WORDS = 8;
const MAX_DUE_GRAMMAR = 2;
/** At most this many brand-new words per passage (SPEC §5.2). */
export const MAX_NEW_WORDS_PER_PASSAGE = 3;

/** Built-in everyday situations, mixed with the learner's interest tags. */
export const EVERYDAY_TOPICS = [
	'shopping',
	'school',
	'weekend plans',
	'cooking',
	'the weather',
	'a trip to the park',
	'meeting a friend',
	'a day at work',
	'eating at a restaurant',
	'a family visit'
];

export function buildPassageRequest(input: RequestInput): PassageRequest {
	const { items, now, settings, random = Math.random } = input;
	const oldestDueFirst = (type: LearnerItem['item_type']) =>
		items
			.filter((i) => i.item_type === type && new Date(i.due) <= now)
			.toSorted((a, b) => Date.parse(a.due) - Date.parse(b.due))
			.map((i) => i.item_key);

	const lessonId = currentLesson(input.completedLessons, input.lessons);
	const lessonGrammar = input.grammarPoints.filter((p) => p.lesson_id === lessonId);
	const dueGrammar = oldestDueFirst('grammar')
		.filter((id) => !lessonGrammar.some((p) => p.id === id))
		.map((id) => input.grammarPoints.find((p) => p.id === id))
		.filter((p) => p !== undefined)
		.slice(0, MAX_DUE_GRAMMAR);
	const knownWords = items.filter((i) => i.item_type === 'word' && i.status === 'known').length;

	return {
		lessonId,
		targetGrammar: [...lessonGrammar, ...dueGrammar],
		dueWords: oldestDueFirst('word').slice(0, MAX_DUE_WORDS),
		allowedWords: allowedWords(items, input.vocab),
		newWords: pickNewWords(items, input.vocab, settings.daily_new_words, input.dayStart),
		topic: pickTopic(settings.interest_tags, random),
		format: nextFormat(input.lastFormat),
		politeness: settings.politeness,
		sentenceCount: sentenceCount(knownWords)
	};
}

/** Passage length grows with vocabulary: 4 sentences to start, one more per 75 known words, at most 20. */
export function sentenceCount(knownWords: number): number {
	return Math.min(4 + Math.floor(knownWords / 75), 20);
}

/** Prose and dialogue take turns; the first passage is prose. */
export function nextFormat(last: PassageFormat | null): PassageFormat {
	return last === 'prose' ? 'dialogue' : 'prose';
}

/** Half the time one of the learner's interests (when they have any), otherwise an everyday situation. */
export function pickTopic(interests: string[], random: () => number = Math.random): string {
	const pool = interests.length && random() < 0.5 ? interests : EVERYDAY_TOPICS;
	return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/**
 * Today's next JLPT words, lowest level first (N5 before N4), skipping words already introduced:
 * up to 3, and no more than what's left of daily_new_words after the JLPT words introduced today.
 */
export function pickNewWords(items: LearnerItem[], vocab: VocabWord[], dailyNewWords: number, dayStart: Date): VocabWord[] {
	const words = items.filter((i) => i.item_type === 'word');
	const introducedToday = words.filter(
		(i) => i.source_lesson === null && Date.parse(i.introduced_at) >= dayStart.getTime()
	).length;
	const budget = Math.min(MAX_NEW_WORDS_PER_PASSAGE, Math.max(0, dailyNewWords - introducedToday));
	if (!budget) return [];
	const present = new Set(words.map((i) => i.item_key));
	return vocab
		.filter((w) => w.jlpt !== null && ![w.key, ...w.aliases].some((k) => present.has(k)))
		.toSorted((a, b) => b.jlpt! - a.jlpt!)
		.slice(0, budget);
}

/** The latest completed lesson in reading order: the one being practised. */
export function currentLesson(completed: string[], lessons: RequestInput['lessons']): string | null {
	const done = lessons.filter((l) => completed.includes(l.id));
	return done.length ? done.reduce((a, b) => (b.order > a.order ? b : a)).id : null;
}

/** An item may be stored under a vocab word's key or one of its aliases; allow every spelling. */
function allowedWords(items: LearnerItem[], vocab: VocabWord[]): Set<string> {
	const spellings = new Map<string, string[]>();
	for (const w of vocab) {
		const all = [w.key, ...w.aliases];
		for (const key of all) spellings.set(key, all);
	}
	return new Set(
		items.filter((i) => i.item_type === 'word').flatMap((i) => spellings.get(i.item_key) ?? [i.item_key])
	);
}
