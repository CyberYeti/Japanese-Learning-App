// Grading a passage when the reader presses Done (SPEC §5.5, ADR 0002): taps and comprehension
// answers become FSRS ratings, and due words are only rated if they verifiably occur in the text.
import { isDue, Rating, review, type Grade, type ScheduledItem } from './scheduler';

export interface ItemGrade {
	item_type: ScheduledItem['item_type'];
	item_key: string;
	/** Passages only give Again or Good; flashcards use all four (SPEC §5.7). */
	rating: Grade;
	source: 'passage' | 'question' | 'flashcard';
}

export interface QuestionAnswer {
	grammar_id: string;
	correct: boolean;
}

export interface PassageGradingInput {
	/** Per sentence, the vocab key of each token (Analysis.keys): null for non-content tokens. */
	sentenceKeys: (string | null)[][];
	/** Vocab keys of the words the reader tapped. */
	tapped: Iterable<string>;
	answers: QuestionAnswer[];
	/** The `items` rows for the passage's words and its questions' grammar points; others are ignored. */
	items: ScheduledItem[];
	/** The key an item is stored under for a spelling (aliases → vocab key). Defaults to the key itself. */
	canonical?: (key: string) => string;
	now: Date;
}

export function gradePassage({
	sentenceKeys,
	tapped,
	answers,
	items,
	canonical = (key) => key,
	now
}: PassageGradingInput): ItemGrade[] {
	const words = new Map(items.filter((i) => i.item_type === 'word').map((i) => [i.item_key, i]));
	const grammar = new Set(items.filter((i) => i.item_type === 'grammar').map((i) => i.item_key));
	const occurring = new Set(sentenceKeys.flat().filter((k) => k !== null).map(canonical));
	const tappedKeys = new Set([...tapped].map(canonical));

	const grades: ItemGrade[] = [];
	for (const [key, item] of words) {
		// A tapped word was forgotten, due or not; an untapped one only counts as a review if it was due.
		if (tappedKeys.has(key)) grades.push(wordGrade(key, Rating.Again));
		else if (occurring.has(key) && isDue(item, now)) grades.push(wordGrade(key, Rating.Good));
	}

	const results = new Map<string, boolean>();
	for (const { grammar_id, correct } of answers) {
		if (grammar.has(grammar_id)) results.set(grammar_id, (results.get(grammar_id) ?? true) && correct);
	}
	for (const [item_key, correct] of results) {
		grades.push({ item_type: 'grammar', item_key, rating: correct ? Rating.Good : Rating.Again, source: 'question' });
	}
	return grades;
}

const wordGrade = (item_key: string, rating: Rating.Again | Rating.Good): ItemGrade => ({
	item_type: 'word',
	item_key,
	rating,
	source: 'passage'
});

/** The graded items, each rescheduled by its rating. */
export function applyGrades(items: ScheduledItem[], grades: ItemGrade[], now: Date): ScheduledItem[] {
	return grades.map((g) => {
		const item = items.find((i) => i.item_type === g.item_type && i.item_key === g.item_key);
		if (!item) throw new Error(`No item for grade ${g.item_type} ${g.item_key}`);
		return review(item, g.rating, now);
	});
}
