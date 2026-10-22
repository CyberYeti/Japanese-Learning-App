// ts-fsrs wrapper and item status rules (SPEC §5.1). The only place that knows about ts-fsrs.
import { fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';

export { Rating, State };

/** An `items` row: the item plus its FSRS card, with dates as ISO strings as Supabase returns them. */
export interface ScheduledItem {
	item_type: 'word' | 'grammar' | 'kanji';
	item_key: string;
	status: 'learning' | 'known';
	manual_override: boolean;
	due: string;
	stability: number;
	difficulty: number;
	elapsed_days: number;
	scheduled_days: number;
	learning_steps: number;
	reps: number;
	lapses: number;
	state: State;
	last_review: string | null;
}

/** Stability (in days) a review card needs to count as known. A starting guess (SPEC §5.1). */
export const KNOWN_STABILITY_DAYS = 7;

const scheduler = fsrs();

/** A fresh learning item, due now: what the `items` column defaults give. */
export function newScheduledItem(item_type: ScheduledItem['item_type'], item_key: string, now: Date): ScheduledItem {
	return {
		item_type,
		item_key,
		status: 'learning',
		manual_override: false,
		due: now.toISOString(),
		stability: 0,
		difficulty: 0,
		elapsed_days: 0,
		scheduled_days: 0,
		learning_steps: 0,
		reps: 0,
		lapses: 0,
		state: State.New,
		last_review: null
	};
}

export function itemStatus(item: Pick<ScheduledItem, 'state' | 'stability' | 'manual_override'>): ScheduledItem['status'] {
	if (item.manual_override) return 'known';
	return item.state === State.Review && item.stability >= KNOWN_STABILITY_DAYS ? 'known' : 'learning';
}

export const isDue = (item: Pick<ScheduledItem, 'due'>, now: Date) => Date.parse(item.due) <= now.getTime();

/** The item after one review. A lapse (Again) drops it back to learning, overriding a manual "known". */
export function review(item: ScheduledItem, rating: Grade, now: Date): ScheduledItem {
	const { card } = scheduler.next(toCard(item), now, rating);
	const manual_override = rating === Rating.Again ? false : item.manual_override;
	return {
		...item,
		manual_override,
		due: card.due.toISOString(),
		stability: card.stability,
		difficulty: card.difficulty,
		elapsed_days: card.elapsed_days,
		scheduled_days: card.scheduled_days,
		learning_steps: card.learning_steps,
		reps: card.reps,
		lapses: card.lapses,
		state: card.state,
		last_review: card.last_review?.toISOString() ?? now.toISOString(),
		status: itemStatus({ state: card.state, stability: card.stability, manual_override })
	};
}

function toCard(item: ScheduledItem): Card {
	return {
		due: new Date(item.due),
		stability: item.stability,
		difficulty: item.difficulty,
		elapsed_days: item.elapsed_days,
		scheduled_days: item.scheduled_days,
		learning_steps: item.learning_steps,
		reps: item.reps,
		lapses: item.lapses,
		state: item.state,
		last_review: item.last_review ? new Date(item.last_review) : undefined
	};
}
