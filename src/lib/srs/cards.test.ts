import { describe, expect, it } from 'vitest';
import type { GrammarPoint } from '../nlp/grammar';
import type { VocabWord } from '../vocab/vocab';
import { cardFace, rateCard, requeue, vocabIndex } from './cards';
import { newScheduledItem, Rating, State } from './scheduler';

const now = new Date('2026-10-25T12:00:00Z');

const vocabWord = (key: string, gloss: string, aliases: string[] = []): VocabWord => ({
	key,
	kanji: null,
	kana: key.split('|')[1],
	gloss,
	jlpt: 5,
	jmdictId: null,
	aliases,
	lessons: []
});

const point: GrammarPoint = {
	id: 'copula-da',
	name: 'だ (state-of-being: is)',
	lesson_id: 'stateofbeing',
	level: 1,
	matcher: { sequences: [] },
	prompt_hint: 'Attach だ to a noun to say something is so.',
	examples: ['人だ。', '学生だ。'],
	polite_examples: ['学生です。']
};

const vocab = vocabIndex([vocabWord('食べる|たべる', 'to eat'), vocabWord('居る|いる', 'to be', ['いる|いる'])]);
const grammar = new Map([[point.id, point]]);

describe('cardFace', () => {
	it('shows a word on the front and its reading and gloss on the back', () => {
		expect(cardFace(newScheduledItem('word', '食べる|たべる', now), vocab, grammar)).toEqual({
			front: '食べる',
			reading: 'たべる',
			meaning: 'to eat',
			note: null
		});
	});

	it('finds the gloss of a word stored under an alias, and omits a reading that repeats the spelling', () => {
		expect(cardFace(newScheduledItem('word', 'いる|いる', now), vocab, grammar)).toEqual({
			front: 'いる',
			reading: null,
			meaning: 'to be',
			note: null
		});
	});

	it('leaves the meaning empty for a word missing from the vocab lists', () => {
		expect(cardFace(newScheduledItem('word', '猫|ねこ', now), vocab, grammar).meaning).toBeNull();
	});

	it('shows a grammar example on the front, rotating with each review, and the point on the back', () => {
		const item = newScheduledItem('grammar', 'copula-da', now);
		expect(cardFace(item, vocab, grammar)).toEqual({
			front: '学生です。',
			reading: null,
			meaning: 'だ (state-of-being: is)',
			note: 'Attach だ to a noun to say something is so.'
		});
		expect(cardFace({ ...item, reps: 1 }, vocab, grammar).front).toBe('人だ。');
		expect(cardFace({ ...item, reps: 3 }, vocab, grammar).front).toBe('学生です。');
	});

	it('falls back to the key for a grammar point no longer in the data', () => {
		expect(cardFace(newScheduledItem('grammar', 'gone', now), vocab, grammar).front).toBe('gone');
	});
});

describe('rateCard', () => {
	it('reschedules the item and logs the rating as a flashcard review', () => {
		const item = newScheduledItem('word', '食べる|たべる', now);
		const { updated, grade } = rateCard(item, Rating.Easy, now);
		expect(grade).toEqual({ item_type: 'word', item_key: '食べる|たべる', rating: Rating.Easy, source: 'flashcard' });
		expect(updated.reps).toBe(1);
		expect(updated.state).toBe(State.Review);
		expect(Date.parse(updated.due)).toBeGreaterThan(now.getTime() + 24 * 3600 * 1000);
	});

	it('gives each of the four ratings a different interval', () => {
		const item = newScheduledItem('word', '食べる|たべる', now);
		const dues = ([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const).map((r) => Date.parse(rateCard(item, r, now).updated.due));
		expect(dues).toEqual([...dues].sort((a, b) => a - b));
		expect(new Set(dues).size).toBe(4);
	});
});

describe('requeue', () => {
	const a = newScheduledItem('word', 'a|a', now);
	const b = newScheduledItem('word', 'b|b', now);

	it('drops a card that is not due again soon', () => {
		const updated = rateCard(a, Rating.Easy, now).updated;
		expect(requeue([a, b], updated, now)).toEqual([b]);
	});

	it('moves a card due again within the session to the back of the queue', () => {
		const updated = rateCard(a, Rating.Again, now).updated;
		expect(requeue([a, b], updated, now)).toEqual([b, updated]);
	});
});
