import { describe, expect, it } from 'vitest';
import type { GrammarPoint } from '../nlp/grammar';
import type { VocabWord } from '../vocab/vocab';
import { DEFAULT_SETTINGS } from '../settings/settings';
import {
	buildPassageRequest,
	EVERYDAY_TOPICS,
	nextFormat,
	pickNewWords,
	pickTopic,
	sentenceCount,
	type LearnerItem,
	type RequestInput
} from './request';

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

const word = (key: string, aliases: string[] = [], jlpt: number | null = 5): VocabWord => ({
	key,
	kanji: null,
	kana: key.split('|')[1],
	gloss: '',
	jlpt,
	jmdictId: null,
	aliases,
	lessons: []
});
const vocab = [word('居る|いる', ['いる|いる']), word('魚|さかな')];

const now = new Date('2026-10-21T12:00:00Z');
const dayStart = new Date('2026-10-21T00:00:00Z');
const item = (item_type: LearnerItem['item_type'], item_key: string, due = '2026-10-30T00:00:00Z', status: LearnerItem['status'] = 'learning'): LearnerItem => ({
	item_type,
	item_key,
	status,
	due,
	source_lesson: 'stateofbeing',
	introduced_at: '2026-10-01T00:00:00Z'
});

const build = (items: LearnerItem[], completedLessons: string[] = [], options: Partial<RequestInput> = {}) =>
	buildPassageRequest({
		items,
		completedLessons,
		lessons,
		grammarPoints,
		vocab,
		settings: DEFAULT_SETTINGS,
		lastFormat: null,
		dayStart,
		now,
		random: () => 0,
		...options
	});

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

	it('starts with a short polite prose passage about an everyday situation', () => {
		const request = build([]);
		expect(EVERYDAY_TOPICS).toContain(request.topic);
		expect(request).toMatchObject({ format: 'prose', politeness: 'polite', sentenceCount: 4 });
	});

	it('follows the settings and alternates format', () => {
		const request = build([], [], {
			settings: { ...DEFAULT_SETTINGS, interest_tags: ['trains'], politeness: 'plain' },
			lastFormat: 'prose'
		});
		expect(request).toMatchObject({ topic: 'trains', politeness: 'plain', format: 'dialogue' });
	});

	it('sizes the passage by known words only', () => {
		const known = Array.from({ length: 150 }, (_, i) => item('word', `k${i}|k`, undefined, 'known'));
		const learning = Array.from({ length: 100 }, (_, i) => item('word', `l${i}|l`));
		expect(build([...known, ...learning]).sentenceCount).toBe(6);
	});
});

describe('sentenceCount', () => {
	it('is 4 + one per 75 known words, capped at 20', () => {
		expect([0, 74, 75, 149, 600, 1199, 1200, 5000].map(sentenceCount)).toEqual([4, 4, 5, 5, 12, 19, 20, 20]);
	});
});

describe('nextFormat', () => {
	it('alternates, starting with prose', () => {
		expect([null, 'prose', 'dialogue'].map((f) => nextFormat(f as 'prose' | 'dialogue' | null))).toEqual([
			'prose',
			'dialogue',
			'prose'
		]);
	});
});

describe('pickTopic', () => {
	const sequence = (...values: number[]) => () => values.shift()!;

	it('always picks an everyday situation without interests', () => {
		expect(pickTopic([], sequence(0.9))).toBe(EVERYDAY_TOPICS[9]);
	});

	it('picks an interest about half the time', () => {
		expect(pickTopic(['trains', 'cats'], sequence(0.2, 0.6))).toBe('cats');
		expect(pickTopic(['trains', 'cats'], sequence(0.7, 0))).toBe(EVERYDAY_TOPICS[0]);
	});
});

describe('pickNewWords', () => {
	const jlpt = [word('n4|a', [], 4), word('n5a|b'), word('居る|いる', ['いる|いる']), word('lesson|c', [], null), word('n5b|d'), word('n5c|e'), word('n5d|f')];
	const introduced = (key: string, introduced_at: string, source_lesson: string | null = null): LearnerItem => ({
		...item('word', key),
		source_lesson,
		introduced_at
	});
	const pick = (items: LearnerItem[], daily = 10) => pickNewWords(items, jlpt, daily, dayStart).map((w) => w.key);

	it('picks up to 3 JLPT words, lowest level first, skipping words present under any spelling', () => {
		expect(pick([item('word', 'いる|いる')])).toEqual(['n5a|b', 'n5b|d', 'n5c|e']);
	});

	it("counts only today's JLPT introductions against the daily limit", () => {
		const items = [
			introduced('x|x', '2026-10-21T08:00:00Z'),
			introduced('y|y', '2026-10-20T23:00:00Z'), // yesterday
			introduced('z|z', '2026-10-21T09:00:00Z', 'stateofbeing') // from a lesson
		];
		expect(pick(items, 3)).toEqual(['n5a|b', '居る|いる']);
		expect(pick(items, 1)).toEqual([]);
		expect(pick([], 0)).toEqual([]);
	});

	it('reaches the next level once the lower one is used up', () => {
		const items = ['n5a|b', '居る|いる', 'n5b|d', 'n5c|e', 'n5d|f'].map((k) => item('word', k));
		expect(pick(items)).toEqual(['n4|a']);
	});
});
