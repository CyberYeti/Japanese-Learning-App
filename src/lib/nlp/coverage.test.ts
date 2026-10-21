import { beforeAll, describe, expect, it } from 'vitest';
import { analyze } from './content';
import { measureCoverage } from './coverage';
import type { KuromojiTokenizer } from './kuromoji';
import { loadNodeTokenizer } from './node-tokenizer';

let tokenizer: KuromojiTokenizer;
beforeAll(async () => {
	tokenizer = await loadNodeTokenizer();
});

const measure = (texts: string[], allowed: string[]) =>
	measureCoverage(
		texts.map((t) => analyze(tokenizer, t)),
		new Set(allowed)
	);

describe('measureCoverage', () => {
	it('is 1 when every content word is allowed', () => {
		expect(measure(['魚を食べた。'], ['魚|さかな', '食べる|たべる'])).toEqual({ coverage: 1, incidental: [] });
	});

	it('counts each occurrence across all sentences', () => {
		// 本 ×2 allowed, 買う not: 2 of 3 content tokens.
		const result = measure(['本と本。', '買った。'], ['本|ほん']);
		expect(result.coverage).toBeCloseTo(2 / 3);
		expect(result.incidental).toEqual(['買う']);
	});

	it('ignores particles, auxiliaries, punctuation, numbers and names', () => {
		expect(measure(['田中さんは三時に来ました。'], ['来る|くる']).coverage).toBe(1);
	});

	it('lists each incidental word once, by dictionary form', () => {
		expect(measure(['猫を見た。猫を見た。'], ['見る|みる']).incidental).toEqual(['猫']);
	});

	it('treats a text with no content words as fully covered', () => {
		expect(measure(['。'], []).coverage).toBe(1);
	});
});
