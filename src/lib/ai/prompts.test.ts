import { describe, expect, it } from 'vitest';
import type { GrammarPoint } from '../nlp/grammar';
import type { PassageRequest } from '../passage/request';
import { parsePassageDraft, passagePrompt, revisionPrompt, type PassageDraft } from './prompts';

const point = (id: string, name: string, prompt_hint: string): GrammarPoint => ({
	id,
	name,
	lesson_id: 'l',
	level: 1,
	matcher: { sequences: [] },
	prompt_hint,
	examples: []
});

const request: PassageRequest = {
	lessonId: 'particlesintro',
	targetGrammar: [point('wa-topic', 'は (topic)', 'Mark the topic with は.')],
	dueWords: ['魚|さかな'],
	allowedWords: new Set(['魚|さかな', '食べる|たべる', '居る|いる', 'いる|いる']),
	newWords: [],
	topic: 'cooking',
	format: 'prose',
	politeness: 'polite',
	sentenceCount: 6
};

const draft: PassageDraft = {
	title: '料理',
	sentences: [{ jp: '猫は魚を食べます。', en: 'The cat eats fish.' }],
	used_grammar: ['wa-topic'],
	questions: []
};

describe('passagePrompt', () => {
	const prompt = passagePrompt(request);

	it('lists allowed words by dictionary form, each once', () => {
		expect(prompt).toContain('魚、食べる、居る、いる');
	});

	it('names the due words, target grammar with hints, topic, length and politeness', () => {
		expect(prompt).toContain('魚');
		expect(prompt).toContain('wa-topic: は (topic). Mark the topic with は.');
		expect(prompt).toContain('cooking');
		expect(prompt).toContain('6 sentences');
		expect(prompt).toContain('です/ます');
	});

	it('asks for the chosen politeness', () => {
		expect(passagePrompt({ ...request, politeness: 'plain' })).toMatch(/plain forms.*not です\/ます/);
		expect(passagePrompt({ ...request, politeness: 'mixed' })).toMatch(/mix politeness/i);
	});

	it('asks for lines with speakers in a dialogue', () => {
		const prompt = passagePrompt({ ...request, format: 'dialogue' });
		expect(prompt).toContain('dialogue');
		expect(prompt).toMatch(/6 lines of conversation.*speaker's name/);
	});

	it('offers the new words with their glosses', () => {
		const newWord = { key: '犬|いぬ', kanji: '犬', kana: 'いぬ', gloss: 'dog', jlpt: 5, jmdictId: null, aliases: [], lessons: [] };
		expect(passagePrompt({ ...request, newWords: [newWord] })).toMatch(/new words.*犬 \(dog\)/);
		expect(prompt).not.toMatch(/new words/);
	});
});

describe('revisionPrompt', () => {
	const prompt = revisionPrompt(request, { previous: draft, incidentalWords: ['猫'], missingGrammar: [request.targetGrammar[0]] });

	it('shows the previous passage and names the words to replace and the grammar missing', () => {
		expect(prompt).toContain('猫は魚を食べます。');
		expect(prompt).toMatch(/replace[^\n]*猫/i);
		expect(prompt).toMatch(/missing[^\n]*wa-topic/i);
	});

	it('still carries the original instructions', () => {
		expect(prompt).toContain(passagePrompt(request));
	});
});

describe('parsePassageDraft', () => {
	it('accepts a well-formed draft', () => {
		expect(parsePassageDraft(draft)).toEqual(draft);
	});

	it('defaults missing optional lists', () => {
		const { used_grammar, questions, ...rest } = draft;
		expect(parsePassageDraft(rest)).toEqual({ ...rest, used_grammar: [], questions: [] });
	});

	it.each([
		['no sentences', { ...draft, sentences: [] }],
		['a sentence without Japanese', { ...draft, sentences: [{ jp: '', en: 'x' }] }],
		['not an object', 'hello']
	])('rejects %s', (_, value) => {
		expect(() => parsePassageDraft(value)).toThrow();
	});
});
