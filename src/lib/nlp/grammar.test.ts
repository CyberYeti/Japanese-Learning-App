import { beforeAll, describe, expect, it } from 'vitest';
import { matches, type Matcher } from './grammar';
import type { KuromojiTokenizer } from './kuromoji';
import { loadNodeTokenizer } from './node-tokenizer';
import { tokenizeWith } from './tokenize';

let tokenizer: KuromojiTokenizer;
beforeAll(async () => {
	tokenizer = await loadNodeTokenizer();
}, 30_000);

const matchesText = (matcher: Matcher, text: string) => matches(matcher, tokenizeWith(tokenizer, text));

describe('matches', () => {
	const teIru: Matcher = {
		sequences: [[{ pos: '動詞' }, { surface: 'て' }, { basic_form: 'いる' }]]
	};

	it('finds a token sequence anywhere in the text', () => {
		expect(matchesText(teIru, '猫がご飯を食べている。')).toBe(true);
	});

	it('needs the sequence to be contiguous', () => {
		expect(matchesText(teIru, '食べて、家にいる。')).toBe(false);
	});

	it('accepts any value from a list', () => {
		const past: Matcher = { sequences: [[{ pos: '動詞' }, { surface: ['た', 'だ'] }]] };
		expect(matchesText(past, '本を読んだ。')).toBe(true);
		expect(matchesText(past, '本を読む。')).toBe(false);
	});

	it('matches if any alternative sequence appears', () => {
		const negative: Matcher = {
			sequences: [
				[{ pos: '動詞' }, { basic_form: 'ない', pos: '助動詞' }],
				[{ basic_form: 'ない', pos: '形容詞' }]
			]
		};
		expect(matchesText(negative, '食べない。')).toBe(true);
		expect(matchesText(negative, 'お金がない。')).toBe(true);
		expect(matchesText(negative, 'お金がある。')).toBe(false);
	});

	it('tells particles apart by their detailed part of speech', () => {
		const finalNo: Matcher = { sequences: [[{ surface: 'の', pos_detail: '終助詞' }]] };
		expect(matchesText(finalNo, 'どこに行くの？')).toBe(true);
		expect(matchesText(finalNo, 'ボブの本。')).toBe(false);
	});

	it('matches conjugation forms by prefix', () => {
		const pastStem: Matcher = { sequences: [[{ pos: '動詞', conjugated_form_prefix: '連用' }]] };
		expect(matchesText(pastStem, '走った。')).toBe(true); // 走っ: 連用タ接続
		expect(matchesText(pastStem, '食べた。')).toBe(true); // 食べ: 連用形
		expect(matchesText(pastStem, '食べる。')).toBe(false); // 食べる: 基本形
	});

	it('rules out tokens that fit a `not` pattern', () => {
		const adverb: Matcher = {
			sequences: [[{ pos: '形容詞', conjugated_form_prefix: '連用テ接続' }, { pos: '動詞', not: { basic_form: 'ある' } }]]
		};
		expect(matchesText(adverb, '早く食べた。')).toBe(true);
		expect(matchesText(adverb, '高くありません。')).toBe(false);
	});

	it('falls back to a regex over the text when no sequence matches', () => {
		const negative: Matcher = { sequences: [[{ surface: 'ない' }]], regex: 'ません(でした)?' };
		expect(matchesText(negative, '食べません。')).toBe(true);
		expect(matchesText(negative, '食べない。')).toBe(true);
		expect(matchesText(negative, '食べます。')).toBe(false);
	});
});
