import { beforeAll, describe, expect, it } from 'vitest';
import { analyze, contentWords, vocabKey } from './content';
import type { KuromojiTokenizer } from './kuromoji';
import { loadNodeTokenizer } from './node-tokenizer';

let tokenizer: KuromojiTokenizer;
beforeAll(async () => {
	tokenizer = await loadNodeTokenizer();
});

const keys = (text: string) => contentWords(tokenizer, text).map((w) => w.key);

describe('vocabKey', () => {
	it('joins dictionary form and hiragana reading', () => {
		expect(vocabKey('食べる', 'たべる')).toBe('食べる|たべる');
		expect(vocabKey('ナイフ', 'ナイフ')).toBe('ナイフ|ないふ');
	});
});

describe('contentWords', () => {
	it('keys conjugated words by their dictionary form and its reading', () => {
		expect(keys('魚を食べた。')).toEqual(['魚|さかな', '食べる|たべる']);
	});

	it('drops particles, auxiliaries, and punctuation', () => {
		expect(keys('学生じゃない人は、学校に行かない。')).toEqual([
			'学生|がくせい',
			'人|ひと',
			'学校|がっこう',
			'行く|いく'
		]);
	});

	it('drops helper verbs that only carry grammar', () => {
		expect(keys('ご飯を食べている。')).toEqual(['ご飯|ごはん', '食べる|たべる']);
	});

	it('drops numbers with their counters, and proper nouns', () => {
		expect(keys('田中さんは三時に来た。')).toEqual(['来る|くる']);
	});

	it('keeps each word once, in first-seen order', () => {
		expect(keys('本と本を買った。')).toEqual(['本|ほん', '買う|かう']);
	});

	it('reads katakana loanwords into hiragana keys', () => {
		expect(keys('ステーキを食べた。')).toEqual(['ステーキ|すてーき', '食べる|たべる']);
	});
});

describe('analyze', () => {
	it('gives each token its vocab key, or null for grammar tokens', () => {
		const { tokens, keys } = analyze(tokenizer, '魚を食べた。');
		expect(tokens.map((t) => t.surface)).toEqual(['魚', 'を', '食べ', 'た', '。']);
		expect(keys).toEqual(['魚|さかな', null, '食べる|たべる', null, null]);
	});

	it('keys every occurrence, not just the first', () => {
		expect(analyze(tokenizer, '本と本').keys).toEqual(['本|ほん', null, '本|ほん']);
	});
});
