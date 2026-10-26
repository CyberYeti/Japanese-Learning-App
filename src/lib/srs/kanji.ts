// Kanji status (SPEC §5.1): a kanji is known automatically once enough known words use it, unless
// the reader has set it by hand. Kanji aren't reviewed, so this is all their status depends on.
import { isKanji } from '../nlp/furigana';

/** A `kanji` items row the reader has set by hand (manual_override), and whether they marked it known. */
export interface KanjiOverride {
	kanji: string;
	known: boolean;
}

export interface KanjiKnowledge {
	/** Kanji used by at least known_kanji_threshold known words. */
	auto: Set<string>;
	/** Kanji set by hand, known (true) or not (false); these win over `auto`. */
	overrides: Map<string, boolean>;
}

/** The kanji in at least `threshold` distinct known words, given as vocab keys (食べる|たべる). */
export function autoKnownKanji(knownWordKeys: Iterable<string>, threshold: number): Set<string> {
	const counts = new Map<string, number>();
	for (const key of new Set(knownWordKeys)) {
		const spelling = key.split('|')[0];
		for (const kanji of new Set([...spelling].filter(isKanji))) counts.set(kanji, (counts.get(kanji) ?? 0) + 1);
	}
	return new Set([...counts].filter(([, n]) => n >= threshold).map(([kanji]) => kanji));
}

export function kanjiKnowledge(knownWordKeys: Iterable<string>, overrides: KanjiOverride[], threshold: number): KanjiKnowledge {
	return {
		auto: autoKnownKanji(knownWordKeys, threshold),
		overrides: new Map(overrides.map((o) => [o.kanji, o.known]))
	};
}

export const isKanjiKnown = (knowledge: KanjiKnowledge, kanji: string): boolean =>
	knowledge.overrides.get(kanji) ?? knowledge.auto.has(kanji);

/** The `kanji` items row a tap writes: status plus whether it's set by hand. */
export interface KanjiRow {
	item_type: 'kanji';
	item_key: string;
	status: 'learning' | 'known';
	manual_override: boolean;
}

/**
 * Tapping a kanji flips whether it's known. Flipping it away from the automatic status sets
 * manual_override; flipping it back clears it, so the kanji follows the known-word rule again.
 */
export function toggleKanji(knowledge: KanjiKnowledge, kanji: string): { knowledge: KanjiKnowledge; row: KanjiRow } {
	const known = !isKanjiKnown(knowledge, kanji);
	const manual = known !== knowledge.auto.has(kanji);
	const overrides = new Map(knowledge.overrides);
	if (manual) overrides.set(kanji, known);
	else overrides.delete(kanji);
	return {
		knowledge: { auto: knowledge.auto, overrides },
		row: { item_type: 'kanji', item_key: kanji, status: known ? 'known' : 'learning', manual_override: manual }
	};
}
