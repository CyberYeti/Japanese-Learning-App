/** One entry of the static vocab lists in static/data/vocab/. */
export interface VocabWord {
	/** Dictionary form + hiragana reading, e.g. 食べる|たべる (see nlp/content.ts vocabKey). */
	key: string;
	/** Kanji spelling, or null for words normally written in kana. */
	kanji: string | null;
	kana: string;
	gloss: string;
	/** JLPT level (5 = N5), or null for lesson words on no JLPT list. */
	jlpt: number | null;
	jmdictId: string | null;
	/** Other keys for this word, from lesson text spelled differently: いる|いる for 居る|いる. */
	aliases: string[];
	/** Ids of the lessons whose examples use this word, in lesson order. */
	lessons: string[];
}

/** Each alias's vocab key (いる|いる → 居る|いる): items for aliased spellings are stored under the vocab key. */
export function aliasKeys(vocab: VocabWord[]): Map<string, string> {
	const keys = new Map<string, string>();
	for (const w of vocab) for (const alias of w.aliases) keys.set(alias, w.key);
	return keys;
}
