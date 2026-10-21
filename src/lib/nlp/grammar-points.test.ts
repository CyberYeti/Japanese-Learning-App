// Checks the hand-written grammar points against their own Tae Kim lessons (SPEC §3.2).
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { matches, type GrammarPoint } from './grammar';
import type { KuromojiTokenizer } from './kuromoji';
import { loadNodeTokenizer } from './node-tokenizer';
import { tokenizeWith } from './tokenize';

const readData = (path: string) =>
	JSON.parse(readFileSync(new URL(`../../../static/data/${path}`, import.meta.url), 'utf8'));

interface Lesson {
	id: string;
	section: string;
	examples: { ja: string }[];
}

const points: GrammarPoint[] = readData('grammar_points.json');
const lessons: Lesson[] = readData('lessons/index.json').map((l: { id: string }) => readData(`lessons/${l.id}.json`));

let tokenizer: KuromojiTokenizer;
beforeAll(async () => {
	tokenizer = await loadNodeTokenizer();
}, 30_000);

describe('grammar_points.json', () => {
	it('gives every point a unique id', () => {
		const ids = points.map((p) => p.id);
		expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
	});

	it('covers every Basic Grammar lesson that has examples', () => {
		const uncovered = lessons
			.filter((l) => l.section === 'Basic Grammar' && l.examples.length > 0)
			.filter((l) => !points.some((p) => p.lesson_id === l.id))
			.map((l) => l.id);
		expect(uncovered).toEqual([]);
	});

	it("takes every point's examples from its own lesson", () => {
		const failures = points.flatMap((p) => {
			const lesson = lessons.find((l) => l.id === p.lesson_id);
			if (!lesson) return [`${p.id}: no lesson "${p.lesson_id}"`];
			if (!p.examples.length) return [`${p.id}: no examples`];
			return p.examples
				.filter((ja) => !lesson.examples.some((e) => e.ja === ja))
				.map((ja) => `${p.id}: 「${ja}」 is not an example in ${p.lesson_id}`);
		});
		expect(failures).toEqual([]);
	});

	it('fires each matcher on its examples, plain and polite, and not on its counter-examples', () => {
		const fires = (p: GrammarPoint, ja: string) => matches(p.matcher, tokenizeWith(tokenizer, ja));
		const failures = points.flatMap((p) => [
			...[...p.examples, ...(p.polite_examples ?? [])]
				.filter((ja) => !fires(p, ja))
				.map((ja) => `${p.id}: misses 「${ja}」`),
			...(p.counter_examples ?? []).filter((ja) => fires(p, ja)).map((ja) => `${p.id}: wrongly matches 「${ja}」`)
		]);
		expect(failures).toEqual([]);
	});
});
