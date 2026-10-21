// Typed Supabase queries for lesson progress and the items a completed lesson introduces.
import type { NewItem } from '../lessons/lessons';
import { supabase } from './supabase';

export interface LessonProgress {
	lesson_id: string;
	started_at: string;
	completed_at: string | null;
}

const PROGRESS_COLUMNS = 'lesson_id, started_at, completed_at';

export async function loadLessonProgress(): Promise<LessonProgress[]> {
	const { data, error } = await supabase.from('lesson_progress').select(PROGRESS_COLUMNS);
	if (error) throw new Error(`Loading lesson progress failed: ${error.message}`);
	return data as LessonProgress[];
}

/** Record that a lesson was opened, keeping the first started_at; returns its progress. */
export async function startLesson(lessonId: string): Promise<LessonProgress> {
	const { error } = await supabase
		.from('lesson_progress')
		.upsert({ lesson_id: lessonId }, { onConflict: 'user_id,lesson_id', ignoreDuplicates: true });
	if (error) throw new Error(`Saving lesson progress failed: ${error.message}`);
	const loaded = await supabase.from('lesson_progress').select(PROGRESS_COLUMNS).eq('lesson_id', lessonId).single();
	if (loaded.error) throw new Error(`Loading lesson progress failed: ${loaded.error.message}`);
	return loaded.data as LessonProgress;
}

/**
 * Introduce the lesson's items as learning (due now) and mark it complete. Items already present
 * keep their FSRS state, so completing a lesson twice never resets a review history.
 * Returns the progress row and how many items were new.
 */
export async function completeLesson(
	lessonId: string,
	items: NewItem[]
): Promise<{ progress: LessonProgress; added: number }> {
	let added = 0;
	if (items.length) {
		// Skipped duplicates aren't returned, so the rows that come back are the ones inserted.
		const { data, error } = await supabase
			.from('items')
			.upsert(items, { onConflict: 'user_id,item_type,item_key', ignoreDuplicates: true })
			.select('item_key');
		if (error) throw new Error(`Adding the lesson's items failed: ${error.message}`);
		added = data.length;
	}
	const { data, error } = await supabase
		.from('lesson_progress')
		.upsert({ lesson_id: lessonId, completed_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' })
		.select(PROGRESS_COLUMNS)
		.single();
	if (error) throw new Error(`Marking the lesson complete failed: ${error.message}`);
	return { progress: data as LessonProgress, added };
}
