// Browser glue for the ready indicator (SPEC §5.6): load a lesson's items and measure how settled they are.
import { loadLessonProgress } from '../db/lessons';
import { loadScheduledItems } from '../db/reviews';
import type { GrammarPoint } from '../nlp/grammar';
import { currentLesson } from '../passage/request';
import { lessonReadiness, type Readiness } from '../srs/readiness';
import { staticJson, type StaticPath } from '../static-data';
import type { VocabWord } from '../vocab/vocab';
import { lessonItems, type Lesson, type LessonSummary } from './lessons';

export async function loadLessonReadiness(lesson: Pick<Lesson, 'id' | 'words'>): Promise<Readiness> {
	const [grammarPoints, n5, lessonWords] = await Promise.all([
		staticJson<GrammarPoint[]>('data/grammar_points.json'),
		staticJson<VocabWord[]>('data/vocab/n5.json'),
		staticJson<VocabWord[]>('data/vocab/lessons.json')
	]);
	const introduced = lessonItems(lesson, grammarPoints, [...n5, ...lessonWords]);
	const items = await loadScheduledItems(introduced.map((i) => i.item_key));
	return lessonReadiness(introduced, items);
}

/** The latest completed lesson and its readiness, or null before any lesson is completed. */
export async function loadCurrentLesson(): Promise<{ lesson: LessonSummary; readiness: Readiness } | null> {
	const [index, progress] = await Promise.all([staticJson<LessonSummary[]>('data/lessons/index.json'), loadLessonProgress()]);
	const id = currentLesson(
		progress.filter((p) => p.completed_at).map((p) => p.lesson_id),
		index
	);
	const summary = index.find((l) => l.id === id);
	if (!summary) return null;
	const lesson = await staticJson<Lesson>(`data/lessons/${summary.id}.json` as StaticPath);
	return { lesson: summary, readiness: await loadLessonReadiness(lesson) };
}
