// Flashcard mode (SPEC §5.7): due words and grammar points shown as front/back cards and rated with
// all four FSRS grades. The same items and scheduler as passages; only the way of reviewing differs.
import type { GrammarPoint } from '../nlp/grammar';
import type { VocabWord } from '../vocab/vocab';
import { applyGrades, type ItemGrade } from './grading';
import type { Grade, ScheduledItem } from './scheduler';

export interface CardFace {
	/** The word, or for grammar an example sentence that uses the point. */
	front: string;
	/** Revealed with the back. The word's reading when its spelling isn't already kana. */
	reading: string | null;
	/** The word's gloss or the grammar point's name; null when the static data has none. */
	meaning: string | null;
	/** For grammar, how the point is used. */
	note: string | null;
}

/** Vocab entries by key and by alias, since an item may be stored under either. */
export function vocabIndex(vocab: VocabWord[]): Map<string, VocabWord> {
	const index = new Map<string, VocabWord>();
	for (const w of vocab) for (const key of [w.key, ...w.aliases]) if (!index.has(key)) index.set(key, w);
	return index;
}

export function cardFace(
	item: Pick<ScheduledItem, 'item_type' | 'item_key' | 'reps'>,
	vocab: Map<string, VocabWord>,
	grammar: Map<string, GrammarPoint>
): CardFace {
	if (item.item_type === 'grammar') {
		const point = grammar.get(item.item_key);
		if (!point) return { front: item.item_key, reading: null, meaning: null, note: null };
		// Rotate through the examples, polite ones first, so the card isn't learned as one sentence.
		const examples = [...(point.polite_examples ?? []), ...point.examples];
		const front = examples.length ? examples[item.reps % examples.length] : point.name;
		return { front, reading: null, meaning: point.name, note: point.prompt_hint || null };
	}
	const [spelling, kana] = item.item_key.split('|');
	return {
		front: spelling,
		reading: kana && kana !== spelling ? kana : null,
		meaning: vocab.get(item.item_key)?.gloss || null,
		note: null
	};
}

/** The rated item rescheduled, and the grade to log, through the same path as passage grading. */
export function rateCard(item: ScheduledItem, rating: Grade, now: Date): { updated: ScheduledItem; grade: ItemGrade } {
	const grade: ItemGrade = { item_type: item.item_type, item_key: item.item_key, rating, source: 'flashcard' };
	const [updated] = applyGrades([item], [grade], now);
	return { updated, grade };
}

/** A card due again within this long (an FSRS learning step) comes back in the same session. */
export const REQUEUE_WINDOW_MS = 20 * 60 * 1000;

/** The queue after rating its first card: that card leaves, or goes to the back if it's due again soon. */
export function requeue(queue: ScheduledItem[], updated: ScheduledItem, now: Date): ScheduledItem[] {
	const rest = queue.slice(1);
	return Date.parse(updated.due) - now.getTime() <= REQUEUE_WINDOW_MS ? [...rest, updated] : rest;
}
