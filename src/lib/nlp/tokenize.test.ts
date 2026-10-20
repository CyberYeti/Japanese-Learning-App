import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildTokenizer, type KuromojiTokenizer } from './kuromoji';
import { tokenizeWith } from './tokenize';

// Uses the same IPADIC files the app ships in static/kuromoji/.
const loadFromStatic = async (file: string) => {
	const bytes = gunzipSync(await readFile(new URL(`../../../static/kuromoji/${file}`, import.meta.url)));
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

let tokenizer: KuromojiTokenizer;
beforeAll(async () => {
	tokenizer = await buildTokenizer(loadFromStatic);
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
