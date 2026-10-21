import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { IncompleteReplyError } from '../ai/generate';
import type { PassageDraft } from '../ai/prompts';
import { analyze } from '../nlp/content';
import type { GrammarPoint } from '../nlp/grammar';
import type { KuromojiTokenizer } from '../nlp/kuromoji';
import { loadNodeTokenizer } from '../nlp/node-tokenizer';
import { generatePassage } from './generate-passage';
import type { PassageRequest } from './request';

const points: GrammarPoint[] = JSON.parse(
	readFileSync(new URL('../../../static/data/grammar_points.json', import.meta.url), 'utf8')
);
const grammar = (id: string) => points.find((p) => p.id === id)!;

let tokenizer: KuromojiTokenizer;
beforeAll(async () => {
	tokenizer = await loadNodeTokenizer();
});

const request: PassageRequest = {
	lessonId: 'particlesintro',
	targetGrammar: [grammar('wa-topic')],
	dueWords: [],
	allowedWords: new Set(['猫|ねこ', '魚|さかな', '食べる|たべる', '肉|にく']),
	topic: 'cooking',
	format: 'prose',
	politeness: 'polite',
	sentenceCount: 2
};

const draft = (...jp: string[]): PassageDraft => ({
	title: '猫',
	sentences: jp.map((s) => ({ jp: s, en: '…' })),
	used_grammar: [],
	questions: []
});

/** A fake model that returns `replies` in order and records every prompt it was sent. */
function model(...replies: unknown[]) {
	const prompts: string[] = [];
	return {
		prompts,
		generate: async (prompt: string) => {
			prompts.push(prompt);
			const reply = replies[prompts.length - 1];
			if (reply instanceof Error) throw reply;
			return reply;
		}
	};
}

const run = (m: ReturnType<typeof model>, options?: { minCoverage?: number }) =>
	generatePassage(request, { generate: m.generate, analyze: async (text) => analyze(tokenizer, text) }, options);

describe('generatePassage', () => {
	it('accepts a first draft that is covered and uses the target grammar', async () => {
		const m = model(draft('猫は魚を食べます。', '猫は肉を食べます。'));
		const result = await run(m);
		expect(m.prompts).toHaveLength(1);
		expect(result).toMatchObject({ accepted: true, attempts: 1, coverage: 1, incidental: [], missingGrammar: [] });
		expect(result.sentences[0].tokens.map((t) => t.surface)).toEqual(['猫', 'は', '魚', 'を', '食べ', 'ます', '。']);
	});

	it('retries naming the words to replace and the grammar missing', async () => {
		const m = model(draft('犬が魚を食べます。'), draft('猫は魚を食べます。'));
		const result = await run(m);
		expect(m.prompts).toHaveLength(2);
		expect(m.prompts[1]).toContain('犬が魚を食べます。');
		expect(m.prompts[1]).toMatch(/replace[^\n]*犬/i);
		expect(m.prompts[1]).toMatch(/missing[^\n]*wa-topic/i);
		expect(result).toMatchObject({ accepted: true, attempts: 2 });
	});

	it('stops after 3 attempts and keeps the best one', async () => {
		const m = model(
			draft('犬が魚を食べます。'), // grammar missing
			draft('犬は鳥を食べます。'), // grammar present, 1/3 covered
			draft('犬は魚を食べます。') // grammar present, 2/3 covered: best
		);
		const result = await run(m);
		expect(m.prompts).toHaveLength(3);
		expect(result.accepted).toBe(false);
		expect(result.attempts).toBe(3);
		expect(result.sentences[0].jp).toBe('犬は魚を食べます。');
		expect(result.coverage).toBeCloseTo(2 / 3);
		expect(result.incidental).toEqual(['犬']);
	});

	it('prefers a draft with the target grammar over one with better coverage', async () => {
		const m = model(draft('猫が魚を食べます。'), draft('犬は魚を食べます。'), draft('猫が肉を食べます。'));
		const result = await run(m);
		expect(result.sentences[0].jp).toBe('犬は魚を食べます。');
	});

	it("doesn't retry for coverage when the learner has no words yet", async () => {
		const m = model(draft('猫は魚を食べます。'));
		const result = await generatePassage(
			{ ...request, allowedWords: new Set() },
			{ generate: m.generate, analyze: async (text) => analyze(tokenizer, text) }
		);
		expect(m.prompts).toHaveLength(1);
		expect(result).toMatchObject({ accepted: true, coverage: 0 });
	});

	it('uses the configured coverage threshold', async () => {
		const m = model(draft('犬は魚を食べます。'));
		expect(await run(m, { minCoverage: 0.6 })).toMatchObject({ accepted: true, attempts: 1 });
	});

	it('retries a malformed reply, and fails if no attempt is usable', async () => {
		const m = model({ sentences: [] }, draft('猫は魚を食べます。'));
		expect(await run(m)).toMatchObject({ accepted: true, attempts: 2 });
		await expect(run(model('x', 'y', 'z'))).rejects.toThrow(/no usable passage/i);
	});

	it('retries a reply the model cut off', async () => {
		const m = model(new IncompleteReplyError('MAX_TOKENS'), draft('猫は魚を食べます。'));
		expect(await run(m)).toMatchObject({ accepted: true, attempts: 2 });
	});

	it('keeps the best attempt so far when a later request fails', async () => {
		const m = model(draft('犬は魚を食べます。'), new Error('429 rate limited'));
		expect(await run(m)).toMatchObject({ accepted: false, attempts: 2, incidental: ['犬'] });
	});

	it('fails when the first request fails', async () => {
		await expect(run(model(new Error('API key not valid')))).rejects.toThrow('API key not valid');
	});
});
