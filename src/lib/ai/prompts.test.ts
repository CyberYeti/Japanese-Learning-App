import { describe, expect, it } from 'vitest';
import type { GrammarPoint } from '../nlp/grammar';
import type { PassageRequest } from '../passage/request';
import {
	explainPrompt,
	parseExplanation,
	parsePassageDraft,
	parseQuiz,
	passagePrompt,
	quizPrompt,
	revisionPrompt,
	shuffleChoices,
	type PassageDraft,
	type QuizQuestion
} from './prompts';

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

describe('explainPrompt', () => {
	const request = {
		selection: '学生じゃない',
		context: 'To say something is not, attach じゃない: 学生じゃない。 (Is not student.)',
		lessonTitle: 'Expressing state-of-being',
		completedLessons: ['Chapter Overview', 'Expressing state-of-being']
	};

	it('sends the highlight, the paragraph around it and the lesson title', () => {
		const prompt = explainPrompt(request);
		expect(prompt).toMatch(/Highlighted text: 学生じゃない\n/);
		expect(prompt).toContain(request.context);
		expect(prompt).toContain('“Expressing state-of-being”');
	});

	it('tells the model what the learner has studied', () => {
		expect(explainPrompt(request)).toContain('completed these lessons so far: Chapter Overview; Expressing state-of-being');
		expect(explainPrompt({ ...request, completedLessons: [] })).toMatch(/not completed any lessons/);
	});

	it('cuts an overlong highlight', () => {
		const prompt = explainPrompt({ ...request, selection: 'あ'.repeat(5000) });
		expect(prompt).not.toContain('あ'.repeat(601));
		expect(prompt).toContain('あ'.repeat(600) + '…');
	});
});

describe('parseExplanation', () => {
	it('keeps the explanation and well-formed parts', () => {
		const parts = [
			{ text: '学生', reading: 'がくせい', meaning: 'student' },
			{ text: 'じゃない', reading: 'じゃない', meaning: 'is not' }
		];
		expect(parseExplanation({ explanation: ' It means “not a student”. ', parts })).toEqual({
			explanation: 'It means “not a student”.',
			parts
		});
	});

	it('drops malformed parts and tolerates a missing reading or parts list', () => {
		expect(parseExplanation({ explanation: 'x', parts: [{ text: '学生', meaning: 'student' }, { text: '', meaning: 'y' }, 3] })).toEqual({
			explanation: 'x',
			parts: [{ text: '学生', reading: '', meaning: 'student' }]
		});
		expect(parseExplanation({ explanation: 'x' })).toEqual({ explanation: 'x', parts: [] });
	});

	it.each([['no explanation', { parts: [] }], ['an empty explanation', { explanation: ' ', parts: [] }], ['not an object', null]])(
		'rejects %s',
		(_, value) => {
			expect(() => parseExplanation(value)).toThrow();
		}
	);
});

describe('quizPrompt', () => {
	const prompt = quizPrompt({
		lessonTitle: 'Expressing state-of-being',
		lessonText: 'Attach だ to a noun.\n学生だ。',
		grammar: [point('copula-da', 'だ (state-of-being: is)', 'Attach だ to a noun.')]
	});

	it('asks for three multiple-choice questions on the lesson, with its grammar and text', () => {
		expect(prompt).toContain('exactly 3 questions');
		expect(prompt).toContain('“Expressing state-of-being”');
		expect(prompt).toContain('- だ (state-of-being: is). Attach だ to a noun.');
		expect(prompt).toContain('学生だ。');
	});

	it('leaves out the grammar list for a lesson with no grammar points', () => {
		expect(quizPrompt({ lessonTitle: 'Overview', lessonText: 'text', grammar: [] })).not.toContain('grammar points');
	});
});

describe('parseQuiz', () => {
	const question: QuizQuestion = { q: 'Which means “is not a student”?', choices: ['学生だ', '学生じゃない', '学生だった'], answer: 1, explanation: 'じゃない negates.' };

	it('keeps well-formed questions, at most three', () => {
		expect(parseQuiz({ questions: [question, question, question, question] })).toEqual([question, question, question]);
	});

	it('drops questions with a bad answer index, too few or repeated choices, or no text', () => {
		const questions = [
			{ ...question, answer: 3 },
			{ ...question, answer: 1.5 },
			{ ...question, choices: ['学生だ'], answer: 0 },
			{ ...question, choices: ['学生だ', '学生だ ', '学生'] },
			{ ...question, q: '' },
			{ ...question, choices: ['a', 2, 'c'] },
			question
		];
		expect(parseQuiz({ questions })).toEqual([question]);
	});

	it('defaults a missing explanation', () => {
		const { explanation, ...rest } = question;
		expect(parseQuiz({ questions: [rest] })).toEqual([{ ...rest, explanation: '' }]);
	});

	it.each([['no questions', { questions: [] }], ['only malformed questions', { questions: [{ q: 'x' }] }], ['not an object', 'quiz']])(
		'rejects %s',
		(_, value) => {
			expect(() => parseQuiz(value)).toThrow();
		}
	);
});

describe('shuffleChoices', () => {
	const question: QuizQuestion = { q: 'q', choices: ['right', 'b', 'c', 'd'], answer: 0, explanation: '' };

	it('moves the answer index along with the right choice', () => {
		for (const r of [0, 0.3, 0.6, 0.99]) {
			const shuffled = shuffleChoices(question, () => r);
			expect(shuffled.choices.toSorted()).toEqual(question.choices.toSorted());
			expect(shuffled.choices[shuffled.answer]).toBe('right');
		}
	});

	it('can move the answer away from the first choice', () => {
		expect(shuffleChoices(question, () => 0).answer).not.toBe(0);
	});
});
