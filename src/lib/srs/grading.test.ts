import { describe, expect, it } from 'vitest';
import { applyGrades, gradePassage, type PassageGradingInput } from './grading';
import { newScheduledItem, Rating, type ScheduledItem } from './scheduler';

const now = new Date('2026-10-21T12:00:00Z');
const later = '2026-10-30T00:00:00Z';

const word = (key: string, due = now.toISOString()): ScheduledItem => ({ ...newScheduledItem('word', key, now), due });
const grammar = (key: string, due = now.toISOString()): ScheduledItem => ({ ...newScheduledItem('grammar', key, now), due });

const grade = (input: Partial<PassageGradingInput>) =>
	gradePassage({ sentenceKeys: [], tapped: [], answers: [], items: [], now, ...input });

describe('gradePassage', () => {
	it('rates a due word that appeared and was not tapped Good', () => {
		const grades = grade({ sentenceKeys: [[null, '魚|さかな', null]], items: [word('魚|さかな')] });
		expect(grades).toEqual([{ item_type: 'word', item_key: '魚|さかな', rating: Rating.Good, source: 'passage' }]);
	});

	it('rates a due word that appeared and was tapped Again', () => {
		const grades = grade({ sentenceKeys: [['魚|さかな']], tapped: ['魚|さかな'], items: [word('魚|さかな')] });
		expect(grades).toEqual([{ item_type: 'word', item_key: '魚|さかな', rating: Rating.Again, source: 'passage' }]);
	});

	it('logs nothing for a due word the passage omitted, so it stays due', () => {
		expect(grade({ sentenceKeys: [['本|ほん']], items: [word('魚|さかな')] })).toEqual([]);
	});

	it('rates a tapped word that is not due Again, and ignores untapped ones', () => {
		const grades = grade({
			sentenceKeys: [['魚|さかな', '本|ほん']],
			tapped: ['魚|さかな'],
			items: [word('魚|さかな', later), word('本|ほん', later)]
		});
		expect(grades).toEqual([{ item_type: 'word', item_key: '魚|さかな', rating: Rating.Again, source: 'passage' }]);
	});

	it('rates a word once however often it appears or is tapped', () => {
		const grades = grade({
			sentenceKeys: [['魚|さかな'], ['魚|さかな']],
			tapped: ['魚|さかな', '魚|さかな'],
			items: [word('魚|さかな')]
		});
		expect(grades).toHaveLength(1);
	});

	it('ignores tapped words with no item row', () => {
		expect(grade({ sentenceKeys: [['猫|ねこ']], tapped: ['猫|ねこ'] })).toEqual([]);
	});

	it('matches spellings stored under an alias to the item key', () => {
		const grades = grade({
			sentenceKeys: [['いる|いる']],
			items: [word('居る|いる')],
			canonical: (key) => (key === 'いる|いる' ? '居る|いる' : key)
		});
		expect(grades).toEqual([{ item_type: 'word', item_key: '居る|いる', rating: Rating.Good, source: 'passage' }]);
	});

	it('never grades grammar or kanji from taps or occurrence', () => {
		const grades = grade({
			sentenceKeys: [['te-iru']],
			tapped: ['te-iru'],
			items: [grammar('te-iru'), { ...newScheduledItem('kanji', 'te-iru', now) }]
		});
		expect(grades).toEqual([]);
	});

	it('rates grammar Good for a correct answer and Again for a wrong one', () => {
		const grades = grade({
			answers: [
				{ grammar_id: 'te-iru', correct: true },
				{ grammar_id: 'masu-form', correct: false }
			],
			items: [grammar('te-iru', later), grammar('masu-form')]
		});
		expect(grades).toEqual([
			{ item_type: 'grammar', item_key: 'te-iru', rating: Rating.Good, source: 'question' },
			{ item_type: 'grammar', item_key: 'masu-form', rating: Rating.Again, source: 'question' }
		]);
	});

	it('rates grammar Again if any of its questions was answered wrongly', () => {
		const grades = grade({
			answers: [
				{ grammar_id: 'te-iru', correct: true },
				{ grammar_id: 'te-iru', correct: false }
			],
			items: [grammar('te-iru')]
		});
		expect(grades).toEqual([{ item_type: 'grammar', item_key: 'te-iru', rating: Rating.Again, source: 'question' }]);
	});

	it('ignores answers for grammar the learner has no item for', () => {
		expect(grade({ answers: [{ grammar_id: 'unknown', correct: true }] })).toEqual([]);
	});
});

describe('applyGrades', () => {
	it('returns each graded item rescheduled', () => {
		const items = [word('魚|さかな'), word('本|ほん')];
		const updated = applyGrades(items, [{ item_type: 'word', item_key: '魚|さかな', rating: Rating.Good, source: 'passage' }], now);
		expect(updated).toHaveLength(1);
		expect(updated[0].item_key).toBe('魚|さかな');
		expect(updated[0].reps).toBe(1);
		expect(Date.parse(updated[0].due)).toBeGreaterThan(now.getTime());
	});
});
