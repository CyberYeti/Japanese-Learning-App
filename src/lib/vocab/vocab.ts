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
