import { describe, expect, it } from 'vitest';
import { lessonReadiness } from './readiness';

const word = (item_key: string, stability = 0) => ({ item_type: 'word' as const, item_key, stability });
const grammar = (item_key: string, stability = 0) => ({ item_type: 'grammar' as const, item_key, stability });

describe('lessonReadiness', () => {
	const lesson = [grammar('copula-da'), word('学生|がくせい'), word('友達|ともだち'), word('人|ひと'), word('元気|げんき')];

	it('is ready when 80% of the lesson items have stability of at least 3 days', () => {
		const items = [grammar('copula-da', 3), word('学生|がくせい', 4.5), word('友達|ともだち', 10), word('人|ひと', 3), word('元気|げんき', 1)];
		expect(lessonReadiness(lesson, items)).toEqual({ stable: 4, total: 5, ready: true });
	});

	it('is not ready below 80%', () => {
		const items = [grammar('copula-da', 3), word('学生|がくせい', 4.5), word('友達|ともだち', 2.9), word('人|ひと', 3), word('元気|げんき', 1)];
		expect(lessonReadiness(lesson, items)).toEqual({ stable: 3, total: 5, ready: false });
	});

	it('counts a lesson item with no row as not stable, and ignores rows from other lessons', () => {
		const items = [grammar('copula-da', 20), word('猫|ねこ', 20)];
		expect(lessonReadiness(lesson, items)).toEqual({ stable: 1, total: 5, ready: false });
	});

	it('tells a word and a grammar point with the same key apart', () => {
		expect(lessonReadiness([grammar('x')], [word('x', 20)])).toEqual({ stable: 0, total: 1, ready: false });
	});

	it('counts each lesson item once', () => {
		expect(lessonReadiness([word('人|ひと'), word('人|ひと')], [word('人|ひと', 5)])).toEqual({ stable: 1, total: 1, ready: true });
	});

	it('is ready for a lesson that introduces no items', () => {
		expect(lessonReadiness([], [])).toEqual({ stable: 0, total: 0, ready: true });
	});
});
