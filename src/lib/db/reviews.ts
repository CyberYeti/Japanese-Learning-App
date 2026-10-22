// Typed Supabase queries for FSRS reviews: scheduled items, grading a read passage, and due counts.
import type { ItemGrade } from '../srs/grading';
import type { ScheduledItem } from '../srs/scheduler';
import { loadNewestReadyPassageId } from './passages';
import { supabase } from './supabase';

const SCHEDULE_COLUMNS =
	'item_type, item_key, status, manual_override, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review';

// Kanji aren't reviewed directly, so loads and counts only cover words and grammar.
const REVIEWED_TYPES = ['word', 'grammar'];

// Keys go in the query string; keep each request's URL well under server limits.
const KEYS_PER_QUERY = 50;

/** The word and grammar items stored under any of `keys`. */
export async function loadScheduledItems(keys: string[]): Promise<ScheduledItem[]> {
	const unique = [...new Set(keys)];
	const chunks = Array.from({ length: Math.ceil(unique.length / KEYS_PER_QUERY) }, (_, i) =>
		unique.slice(i * KEYS_PER_QUERY, (i + 1) * KEYS_PER_QUERY)
	);
	const results = await Promise.all(
		chunks.map((chunk) =>
			supabase.from('items').select(SCHEDULE_COLUMNS).in('item_type', REVIEWED_TYPES).in('item_key', chunk)
		)
	);
	return results.flatMap(({ data, error }) => {
		if (error) throw new Error(`Loading items failed: ${error.message}`);
		return data as ScheduledItem[];
	});
}

/**
 * Mark the passage read, save the rescheduled items and append their review log, all in one
 * transaction (record_passage_review in supabase/schema.sql). Returns false, writing nothing, if the
 * passage was already read, so it is never graded twice.
 */
export async function recordPassageReview(
	passageId: string,
	updated: ScheduledItem[],
	grades: ItemGrade[],
	now: Date
): Promise<boolean> {
	const { data, error } = await supabase.rpc('record_passage_review', {
		p_passage_id: passageId,
		p_items: updated,
		p_reviews: grades,
		p_reviewed_at: now.toISOString()
	});
	if (error) throw new Error(`Saving reviews failed: ${error.message}`);
	return data as boolean;
}

export interface HomeSummary {
	/** Words and grammar points due now. */
	due: number;
	learning: number;
	known: number;
	/** The newest unread passage, if any. */
	readyPassageId: string | null;
}

export async function loadHomeSummary(now: Date): Promise<HomeSummary> {
	const [due, learning, known, readyPassageId] = await Promise.all([
		countItems().lte('due', now.toISOString()),
		countItems().eq('status', 'learning'),
		countItems().eq('status', 'known'),
		loadNewestReadyPassageId()
	]);
	for (const result of [due, learning, known]) {
		if (result.error) throw new Error(`Loading your progress failed: ${result.error.message}`);
	}
	return {
		due: due.count ?? 0,
		learning: learning.count ?? 0,
		known: known.count ?? 0,
		readyPassageId
	};
}

const countItems = () => supabase.from('items').select('*', { count: 'exact', head: true }).in('item_type', REVIEWED_TYPES);
