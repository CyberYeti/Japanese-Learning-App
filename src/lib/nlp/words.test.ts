import { beforeAll, describe, expect, it } from 'vitest';
import type { KuromojiTokenizer } from './kuromoji';
import { loadNodeTokenizer } from './node-tokenizer';
import { tokenizeWith } from './tokenize';
import { describeConjugation, groupWords } from './words';

let tokenizer: KuromojiTokenizer;
beforeAll(async () => {
	tokenizer = await loadNodeTokenizer();
}, 30_000);

/** [surface, dictionary form] for each word in the text. */
const words = (text: string) =>
	groupWords(tokenizeWith(tokenizer, text)).map((w) => [w.surface, w.head.basicForm]);

describe('groupWords', () => {
	it('keeps a verb and its conjugation endings as one word', () => {
		expect(words('見ました')).toEqual([['見ました', '見る']]);
	});

	it('keeps an adjective and its past ending as one word', () => {
		expect(words('面白かった')).toEqual([['面白かった', '面白い']]);
	});

	it('joins て-form helper verbs onto the main verb', () => {
		expect(words('食べています')).toEqual([['食べています', '食べる']]);
		expect(words('食べてしまった')).toEqual([['食べてしまった', '食べる']]);
	});

	it('keeps particles and punctuation as their own words in a sentence', () => {
		expect(words('今日は友達と映画を見ました。').map(([surface]) => surface)).toEqual([
			'今日',
			'は',
			'友達',
			'と',
			'映画',
			'を',
			'見ました',
			'。'
		]);
	});

	it('leaves です after an adjective as its own word', () => {
		expect(words('面白かったです')).toEqual([
			['面白かった', '面白い'],
			['です', 'です']
		]);
		expect(words('食べたいです')).toEqual([
			['食べたい', '食べる'],
			['です', 'です']
		]);
	});

	it('keeps the でし of ませんでした with the verb', () => {
		expect(words('行きませんでした')).toEqual([['行きませんでした', '行く']]);
	});

	it('leaves a noun and its copula as separate words', () => {
		expect(words('学生です')).toEqual([
			['学生', '学生'],
			['です', 'です']
		]);
	});
});

describe('describeConjugation', () => {
	const describeFirst = (text: string) =>
		describeConjugation(groupWords(tokenizeWith(tokenizer, text))[0]);

	it('names each ending and sums them up', () => {
		expect(describeFirst('見ました')).toEqual({
			parts: [
				{ surface: 'まし', base: 'ます', meaning: 'polite' },
				{ surface: 'た', base: 'た', meaning: 'past' }
			],
			summary: 'polite, past'
		});
	});

	it('treats て before a helper verb as part of that helper', () => {
		expect(describeFirst('食べています')?.summary).toBe('ongoing (〜ている), polite');
		expect(describeFirst('食べて')?.summary).toBe('te-form');
	});

	it('mentions a repeated meaning once', () => {
		expect(describeFirst('行きませんでした')?.summary).toBe('polite, negative, past');
	});

	it('returns nothing for a word with no endings', () => {
		expect(describeFirst('見る')).toBeNull();
	});
});
