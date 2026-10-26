// Learner settings (the `settings` table, SPEC §4): what passages are about and how they're checked.

export type Politeness = 'polite' | 'plain' | 'mixed';

export const POLITENESS: Politeness[] = ['polite', 'plain', 'mixed'];

/** A `settings` row, without user_id. */
export interface Settings {
	interest_tags: string[];
	politeness: Politeness;
	/** JLPT words introduced per day through passages (SPEC §5.2). */
	daily_new_words: number;
	/** Known words a kanji must appear in to count as known (SPEC §5.1). */
	known_kanji_threshold: number;
	/** Coverage a passage draft needs to be accepted without a retry, 0–1 (SPEC §5.3). */
	coverage_threshold: number;
}

/** The column defaults in supabase/schema.sql, used until a row is saved. */
export const DEFAULT_SETTINGS: Settings = {
	interest_tags: [],
	politeness: 'polite',
	daily_new_words: 10,
	known_kanji_threshold: 3,
	coverage_threshold: 0.95
};

export const LIMITS = {
	daily_new_words: { min: 0, max: 50 },
	known_kanji_threshold: { min: 1, max: 20 },
	coverage_threshold: { min: 0.5, max: 1 },
	tags: 20,
	tagLength: 40
};

/** Split typed interests on commas (ASCII or Japanese) and new lines; trimmed, without blanks or repeats. */
export function parseInterestTags(text: string): string[] {
	const tags = text
		.split(/[,、，\n]/)
		.map((t) => t.trim().slice(0, LIMITS.tagLength))
		.filter(Boolean);
	const seen = new Set<string>();
	return tags.filter((t) => !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, LIMITS.tags);
}

const clamp = (value: unknown, { min, max }: { min: number; max: number }, fallback: number) => {
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** A complete, in-range Settings from a stored row or form values; anything missing or invalid gets its default. */
export function normalizeSettings(value: Partial<Record<keyof Settings, unknown>> | null | undefined): Settings {
	const v = value ?? {};
	const tags = Array.isArray(v.interest_tags) ? parseInterestTags(v.interest_tags.filter((t) => typeof t === 'string').join('\n')) : [];
	return {
		interest_tags: tags,
		politeness: POLITENESS.includes(v.politeness as Politeness) ? (v.politeness as Politeness) : DEFAULT_SETTINGS.politeness,
		daily_new_words: Math.round(clamp(v.daily_new_words, LIMITS.daily_new_words, DEFAULT_SETTINGS.daily_new_words)),
		known_kanji_threshold: Math.round(
			clamp(v.known_kanji_threshold, LIMITS.known_kanji_threshold, DEFAULT_SETTINGS.known_kanji_threshold)
		),
		coverage_threshold: clamp(v.coverage_threshold, LIMITS.coverage_threshold, DEFAULT_SETTINGS.coverage_threshold)
	};
}
