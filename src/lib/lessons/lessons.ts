// Tae Kim lessons (static/data/lessons/): section navigation and the items "Mark complete" introduces.
import type { GrammarPoint } from '../nlp/grammar';
import { aliasKeys, type VocabWord } from '../vocab/vocab';

/** One entry of static/data/lessons/index.json. */
export interface LessonSummary {
	id: string;
	order: number;
	section: string;
	title: string;
	source_url: string;
}

/** One static/data/lessons/{id}.json file. */
export interface Lesson extends LessonSummary {
	/** Cleaned HTML body from scripts/import_taekim.py. */
	html: string;
	examples: { ja: string; en: string }[];
	/** Vocab keys of the content words the examples use (scripts/build_data.ts). */
	words: string[];
}

export interface HeadingAnchor {
	id: string;
	title: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/** Give each h2 heading an anchor id, so the reader can link to the parts of a lesson. */
export function anchorHeadings(html: string): { html: string; headings: HeadingAnchor[] } {
	const headings: HeadingAnchor[] = [];
	const anchored = html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/g, (_, attrs: string, inner: string) => {
		const id = `section-${headings.length + 1}`;
		const title = inner.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_e, name: string) => ENTITIES[name]);
		headings.push({ id, title: title.trim() });
		return `<h2${attrs} id="${id}">${inner}</h2>`;
	});
	return { html: anchored, headings };
}

/** The lessons before and after `id` in reading order. */
export function adjacentLessons<T extends { id: string; order: number }>(
	index: T[],
	id: string
): { prev: T | null; next: T | null } {
	const ordered = index.toSorted((a, b) => a.order - b.order);
	const i = ordered.findIndex((l) => l.id === id);
	return { prev: ordered[i - 1] ?? null, next: i < 0 ? null : (ordered[i + 1] ?? null) };
}

/** An `items` row to insert; FSRS columns take their defaults (learning, due now). */
export interface NewItem {
	item_type: 'word' | 'grammar';
	item_key: string;
	source_lesson: string;
}

/** The grammar points and words that completing a lesson introduces (SPEC §5.2). */
export function lessonItems(lesson: Pick<Lesson, 'id' | 'words'>, grammarPoints: GrammarPoint[], vocab: VocabWord[]): NewItem[] {
	// Store aliased spellings under the vocab entry's key so JLPT fill-in sees the word as present.
	const canonical = aliasKeys(vocab);

	const grammar = grammarPoints.filter((p) => p.lesson_id === lesson.id).map((p) => p.id);
	const words = [...new Set(lesson.words.map((key) => canonical.get(key) ?? key))];
	return [
		...grammar.map((item_key) => ({ item_type: 'grammar' as const, item_key, source_lesson: lesson.id })),
		...words.map((item_key) => ({ item_type: 'word' as const, item_key, source_lesson: lesson.id }))
	];
}
