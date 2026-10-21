// Step 1 of passage generation (SPEC §5.3): what a passage should be built around.
import type { GrammarPoint } from '../nlp/grammar';
import type { VocabWord } from '../vocab/vocab';

/** The columns of an `items` row that passage building needs. */
export interface LearnerItem {
	item_type: 'word' | 'grammar' | 'kanji';
	item_key: string;
	status: 'learning' | 'known';
	/** ISO timestamp. */
	due: string;
}

export interface PassageRequest {
	/** The lesson whose grammar the passage practises, or null before any lesson is completed. */
	lessonId: string | null;
	targetGrammar: GrammarPoint[];
	/** Vocab keys of due words the passage should use. */
	dueWords: string[];
	/** Vocab keys (with aliases) of every learning or known word. */
	allowedWords: Set<string>;
	topic: string;
	format: 'prose' | 'dialogue';
	politeness: 'polite';
	sentenceCount: number;
}

export interface RequestInput {
	items: LearnerItem[];
	/** Ids of lessons with completed_at set. */
	completedLessons: string[];
	lessons: { id: string; order: number }[];
	grammarPoints: GrammarPoint[];
	vocab: VocabWord[];
	now: Date;
	random?: () => number;
}

const MAX_DUE_WORDS = 8;
const MAX_DUE_GRAMMAR = 2;

// Everyday situations for topics until interest tags exist.
const TOPICS = [
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
	const { items, now, random = Math.random } = input;
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

	return {
		lessonId,
		targetGrammar: [...lessonGrammar, ...dueGrammar],
		dueWords: oldestDueFirst('word').slice(0, MAX_DUE_WORDS),
		allowedWords: allowedWords(items, input.vocab),
		topic: TOPICS[Math.floor(random() * TOPICS.length)],
		format: 'prose',
		politeness: 'polite',
		sentenceCount: 6
	};
}

function currentLesson(completed: string[], lessons: RequestInput['lessons']): string | null {
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
