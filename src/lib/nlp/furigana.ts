import { toHiragana } from './kana';

/** A run of surface text; `ruby` is set on kanji runs and holds their hiragana reading. */
export interface FuriganaSegment {
	text: string;
	ruby?: string;
}

const KANJI = /[一-鿿㐀-䶿豈-﫿々〆〇ヶ]/;

export function isKanji(char: string): boolean {
	return KANJI.test(char);
}

/** Split a surface into alternating kanji / non-kanji runs. */
function runs(surface: string): { text: string; kanji: boolean }[] {
	const out: { text: string; kanji: boolean }[] = [];
	for (const char of surface) {
		const kanji = isKanji(char);
		const last = out.at(-1);
		if (last && last.kanji === kanji) last.text += char;
		else out.push({ text: char, kanji });
	}
	return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Align a word's reading to its surface so each kanji run gets its own ruby and kana
 * (okurigana) is not repeated: 食べる + たべる → 食[た]べる.
 */
export function alignFurigana(surface: string, reading: string): FuriganaSegment[] {
	const parts = runs(surface);
	const pattern = parts
		.map((p) => (p.kanji ? '(.+?)' : `(${escape(toHiragana(p.text))})`))
		.join('');
	const match = new RegExp(`^${pattern}$`).exec(toHiragana(reading));
	if (!match) return [{ text: surface, ruby: toHiragana(reading) }];
	return parts.map((p, i) => (p.kanji ? { text: p.text, ruby: match[i + 1] } : { text: p.text }));
}
