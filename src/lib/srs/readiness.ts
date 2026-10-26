// The "ready" indicator for moving past a lesson (SPEC §5.6). Advisory only: lessons are never locked.
import type { ScheduledItem } from './scheduler';

/** Stability (in days) an item needs to count towards readiness. */
export const READY_STABILITY_DAYS = 3;
/** Share of the lesson's items that must be that stable. */
export const READY_SHARE = 0.8;

type ItemRef = Pick<ScheduledItem, 'item_type' | 'item_key'>;

export interface Readiness {
	/** The lesson's items with stability ≥ READY_STABILITY_DAYS. */
	stable: number;
	total: number;
	ready: boolean;
}

/**
 * How settled a lesson's items are. `lessonItems` are the items the lesson introduces; `items` their
 * rows. One with no row (added and since deleted, say) counts as not yet stable. A lesson that
 * introduces nothing, like a chapter overview, is ready at once.
 */
export function lessonReadiness(lessonItems: ItemRef[], items: Pick<ScheduledItem, 'item_type' | 'item_key' | 'stability'>[]): Readiness {
	const id = (i: ItemRef) => `${i.item_type}:${i.item_key}`;
	const stability = new Map(items.map((i) => [id(i), i.stability]));
	const keys = new Set(lessonItems.map(id));
	let stable = 0;
	for (const key of keys) if ((stability.get(key) ?? 0) >= READY_STABILITY_DAYS) stable++;
	return { stable, total: keys.size, ready: stable >= READY_SHARE * keys.size };
}
