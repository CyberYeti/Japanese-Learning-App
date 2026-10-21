import { describe, expect, it } from 'vitest';
import type { GrammarPoint } from '../nlp/grammar';
import type { VocabWord } from '../vocab/vocab';
import { buildPassageRequest, type LearnerItem } from './request';

const point = (id: string, lesson_id: string): GrammarPoint => ({
	id,
	name: id,
	lesson_id,
	level: 1,
	matcher: { sequences: [] },
	prompt_hint: `use ${id}`,
	examples: []
});

const grammarPoints = [point('copula-da', 'stateofbeing'), point('wa-topic', 'particlesintro'), point('mo-inclusive', 'particlesintro'), point('verb-past', 'past_tense')];
const lessons = [
	{ id: 'stateofbeing', order: 2 },
	{ id: 'particlesintro', order: 3 },
	{ id: 'past_tense', order: 7 }
];

const word = (key: string, aliases: string[] = []): VocabWord => ({
	key,
	kanji: null,
	kana: key.split('|')[1],
	gloss: '',
	jlpt: 5,
	jmdictId: null,
	aliases,
	lessons: []
});
const vocab = [word('居る|いる', ['いる|いる']), word('魚|さかな')];

const now = new Date('2026-10-21T12:00:00Z');
const item = (item_type: LearnerItem['item_type'], item_key: string, due = '2026-10-30T00:00:00Z', status: LearnerItem['status'] = 'learning'): LearnerItem => ({
	item_type,
	item_key,
	status,
	due
});

const build = (items: LearnerItem[], completedLessons: string[] = []) =>
	buildPassageRequest({ items, completedLessons, lessons, grammarPoints, vocab, now, random: () => 0 });

describe('buildPassageRequest', () => {
	it("targets the grammar of the latest completed lesson in lesson order", () => {
		const request = build([], ['particlesintro', 'stateofbeing']);
		expect(request.lessonId).toBe('particlesintro');
		expect(request.targetGrammar.map((p) => p.id)).toEqual(['wa-topic', 'mo-inclusive']);
	});

	it('adds up to 2 due grammar items, oldest first, without repeating lesson grammar', () => {
		const request = build(
			[
				item('grammar', 'verb-past', '2026-10-21T09:00:00Z'),
				item('grammar', 'wa-topic', '2026-10-20T00:00:00Z'),
				item('grammar', 'copula-da', '2026-10-21T08:00:00Z'),
				item('grammar', 'mo-inclusive', '2026-10-19T00:00:00Z')
			],
			['particlesintro']
		);
		expect(request.targetGrammar.map((p) => p.id)).toEqual(['wa-topic', 'mo-inclusive', 'copula-da', 'verb-past']);
	});

	it('has no lesson grammar before any lesson is completed', () => {
		const request = build([item('grammar', 'copula-da', '2026-10-01T00:00:00Z')]);
		expect(request.lessonId).toBeNull();
		expect(request.targetGrammar.map((p) => p.id)).toEqual(['copula-da']);
	});

	it('lists up to 8 due words, oldest first', () => {
		const due = Array.from({ length: 10 }, (_, i) => item('word', `w${i}|w`, `2026-10-${String(20 - i).padStart(2, '0')}T00:00:00Z`));
		const request = build([...due, item('word', 'later|l')]);
		expect(request.dueWords).toEqual(['w9|w', 'w8|w', 'w7|w', 'w6|w', 'w5|w', 'w4|w', 'w3|w', 'w2|w']);
	});

	it('allows every learning and known word, with its vocab aliases', () => {
		const request = build([item('word', '居る|いる'), item('word', '魚|さかな', undefined, 'known'), item('kanji', '魚'), item('grammar', 'copula-da')]);
		expect([...request.allowedWords].sort()).toEqual(['いる|いる', '居る|いる', '魚|さかな'].sort());
	});

	it('resolves an alias item to its vocab word too', () => {
		expect([...build([item('word', 'いる|いる')]).allowedWords].sort()).toEqual(['いる|いる', '居る|いる'].sort());
	});

	it('picks a topic and starts with a short polite prose passage', () => {
		const request = build([]);
		expect(request.topic).toEqual(expect.any(String));
		expect(request).toMatchObject({ format: 'prose', politeness: 'polite', sentenceCount: 6 });
	});
});
