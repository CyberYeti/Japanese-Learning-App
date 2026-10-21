import { beforeAll, describe, expect, it } from 'vitest';
import type { KuromojiTokenizer } from './kuromoji';
import { loadNodeTokenizer } from './node-tokenizer';
import { tokenizeWith } from './tokenize';

let tokenizer: KuromojiTokenizer;
beforeAll(async () => {
	tokenizer = await loadNodeTokenizer();
}, 30_000);

describe('tokenizeWith', () => {
	it('returns surface, base form, POS and hiragana reading for each word', () => {
		expect(tokenizeWith(tokenizer, '食べました')).toEqual([
			{ surface: '食べ', basicForm: '食べる', pos: '動詞', posDetail: '自立', reading: 'たべ' },
			{ surface: 'まし', basicForm: 'ます', pos: '助動詞', posDetail: null, reading: 'まし' },
			{ surface: 'た', basicForm: 'た', pos: '助動詞', posDetail: null, reading: 'た' }
		]);
	});

	it('uses the surface as base form and no reading for words outside the dictionary', () => {
		expect(tokenizeWith(tokenizer, 'ググる')[0]).toEqual({
			surface: 'ググ',
			basicForm: 'ググ',
			pos: '名詞',
			posDetail: '一般',
			reading: null
		});
	});
});
