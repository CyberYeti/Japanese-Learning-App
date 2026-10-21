import { describe, expect, it } from 'vitest';
import type { GrammarPoint } from '../nlp/grammar';
import type { VocabWord } from '../vocab/vocab';
import { adjacentLessons, anchorHeadings, lessonItems } from './lessons';

const point = (id: string, lesson_id: string): GrammarPoint => ({
	id,
	name: id,
	lesson_id,
	level: 1,
	matcher: { sequences: [] },
	prompt_hint: '',
	examples: []
});

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

describe('anchorHeadings', () => {
	it('gives each h2 an anchor id and lists the headings in order', () => {
		const { html, headings } = anchorHeadings('<h2>Using 「だ」</h2>\n<p>x</p>\n<h3>Vocabulary</h3>\n<h2 class="a">Past <em>tense</em></h2>');
		expect(html).toBe('<h2 id="section-1">Using 「だ」</h2>\n<p>x</p>\n<h3>Vocabulary</h3>\n<h2 class="a" id="section-2">Past <em>tense</em></h2>');
		expect(headings).toEqual([
			{ id: 'section-1', title: 'Using 「だ」' },
			{ id: 'section-2', title: 'Past tense' }
		]);
	});

	it('decodes entities in heading titles', () => {
		expect(anchorHeadings('<h2>Nouns &amp; adjectives &lt;1&gt;</h2>').headings[0].title).toBe('Nouns & adjectives <1>');
	});

	it('returns no headings for a lesson without h2s', () => {
		expect(anchorHeadings('<p>Overview</p>')).toEqual({ html: '<p>Overview</p>', headings: [] });
	});
});

describe('adjacentLessons', () => {
	const index = [
		{ id: 'verbs', order: 5, title: 'Verb Basics' },
		{ id: 'stateofbeing', order: 2, title: 'State of being' },
		{ id: 'adjectives', order: 4, title: 'Adjectives' }
	];

	it('finds the previous and next lessons by order', () => {
		const { prev, next } = adjacentLessons(index, 'adjectives');
		expect(prev?.id).toBe('stateofbeing');
		expect(next?.id).toBe('verbs');
	});

	it('has no previous lesson at the start or next lesson at the end', () => {
		expect(adjacentLessons(index, 'stateofbeing').prev).toBeNull();
		expect(adjacentLessons(index, 'verbs').next).toBeNull();
	});
});

describe('lessonItems', () => {
	const grammarPoints = [point('copula-da', 'stateofbeing'), point('copula-negative', 'stateofbeing'), point('wa-topic', 'particlesintro')];
	const vocab = [word('居る|いる', ['いる|いる']), word('学生|がくせい')];

	it("introduces the lesson's grammar points and words, tagged with the lesson", () => {
		const items = lessonItems({ id: 'stateofbeing', words: ['学生|がくせい', '人|ひと'] }, grammarPoints, vocab);
		expect(items).toEqual([
			{ item_type: 'grammar', item_key: 'copula-da', source_lesson: 'stateofbeing' },
			{ item_type: 'grammar', item_key: 'copula-negative', source_lesson: 'stateofbeing' },
			{ item_type: 'word', item_key: '学生|がくせい', source_lesson: 'stateofbeing' },
			{ item_type: 'word', item_key: '人|ひと', source_lesson: 'stateofbeing' }
		]);
	});

	it("stores a word aliased by a vocab entry under the entry's key, once", () => {
		const items = lessonItems({ id: 'verbs', words: ['いる|いる', '居る|いる'] }, grammarPoints, vocab);
		expect(items).toEqual([{ item_type: 'word', item_key: '居る|いる', source_lesson: 'verbs' }]);
	});
});
