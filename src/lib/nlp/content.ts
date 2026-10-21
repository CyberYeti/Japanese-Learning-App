import { isKana, toHiragana } from './kana';
import type { KuromojiTokenizer } from './kuromoji';
import { tokenizeWith, type Token } from './tokenize';

/** A vocabulary word found in text, identified by its stable vocab key. */
export interface ContentWord {
	/** Dictionary form + hiragana reading, e.g. 食べる|たべる. */
	key: string;
	dictForm: string;
	reading: string;
}

export function vocabKey(dictForm: string, reading: string): string {
	return `${dictForm}|${toHiragana(reading)}`;
}

const GRAMMAR_POS = new Set(['助詞', '助動詞', '記号', 'フィラー', 'その他']);
// Numbers, names, and (via 非自立 and 接尾) grammar helpers (the いる of 食べている, the さん of 田中さん).
const NON_VOCAB_DETAIL = new Set(['数', '固有名詞', '非自立', '接尾']);

/** Whether a token counts as vocabulary rather than grammar, punctuation, a number, or a name. */
export function isContentToken(token: Token): boolean {
	return !GRAMMAR_POS.has(token.pos) && !NON_VOCAB_DETAIL.has(token.posDetail ?? '');
}

/**
 * The distinct vocabulary words in `text`, in first-seen order. Readings are of the dictionary
 * form (食べた → たべる), so keys match vocab lists built from dictionary forms.
 */
export function contentWords(tokenizer: KuromojiTokenizer, text: string): ContentWord[] {
	const words = new Map<string, ContentWord>();
	for (const token of tokenizeWith(tokenizer, text)) {
		if (!isContentToken(token)) continue;
		const reading = dictFormReading(tokenizer, token);
		if (!reading) continue;
		const key = vocabKey(token.basicForm, reading);
		if (!words.has(key)) words.set(key, { key, dictForm: token.basicForm, reading: toHiragana(reading) });
	}
	return [...words.values()];
}

function dictFormReading(tokenizer: KuromojiTokenizer, token: Token): string | null {
	if (token.surface === token.basicForm) {
		// Words kuromoji doesn't know have no reading; kana spellings are their own reading.
		return token.reading ?? (isKana(token.surface) ? token.surface : null);
	}
	// Conjugated: the token's reading is of the surface (食べ → たべ), so read the dictionary form.
	const [only, ...rest] = tokenizeWith(tokenizer, token.basicForm);
	return !rest.length && only.basicForm === token.basicForm ? only.reading : null;
}
