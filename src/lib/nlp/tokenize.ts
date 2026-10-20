import type { IpadicFeatures } from 'kuromoji';
import { toHiragana } from './kana';
import type { KuromojiTokenizer } from './kuromoji';

export interface Token {
	surface: string;
	/** Dictionary form, e.g. 食べる for 食べ. */
	basicForm: string;
	/** IPADIC part of speech, e.g. 動詞, 名詞, 助詞. */
	pos: string;
	posDetail: string | null;
	/** Hiragana reading; null for words kuromoji does not know. */
	reading: string | null;
}

export function tokenizeWith(tokenizer: KuromojiTokenizer, text: string): Token[] {
	return tokenizer.tokenize(text).map(toToken);
}

// IPADIC uses '*' for "no value".
const field = (value: string | undefined) => (value && value !== '*' ? value : null);

function toToken(f: IpadicFeatures): Token {
	const reading = field(f.reading);
	return {
		surface: f.surface_form,
		basicForm: field(f.basic_form) ?? f.surface_form,
		pos: f.pos,
		posDetail: field(f.pos_detail_1),
		reading: reading && toHiragana(reading)
	};
}
