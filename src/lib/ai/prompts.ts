// Prompts and reply schemas (SPEC §5.3 step 2). Provider-neutral: generate.ts sends them.
import type { GrammarPoint } from '../nlp/grammar';
import type { PassageRequest } from '../passage/request';
import type { Politeness } from '../settings/settings';

export interface PassageQuestion {
	q: string;
	choices: string[];
	/** Index into `choices`. */
	answer: number;
	grammar_id: string;
}

export interface DraftSentence {
	jp: string;
	en: string;
}

/** A passage as the model writes it, before the app tokenizes and checks it. */
export interface PassageDraft {
	title: string;
	sentences: DraftSentence[];
	used_grammar: string[];
	questions: PassageQuestion[];
}

const STRING = { type: 'string' };
const STRINGS = { type: 'array', items: STRING };

/** Standard JSON Schema. Properties are listed in the order the model should write them. */
export const PASSAGE_SCHEMA = {
	type: 'object',
	properties: {
		title: STRING,
		sentences: {
			type: 'array',
			items: { type: 'object', properties: { jp: STRING, en: STRING }, required: ['jp', 'en'] }
		},
		used_grammar: STRINGS,
		questions: {
			type: 'array',
			items: {
				type: 'object',
				properties: { q: STRING, choices: STRINGS, answer: { type: 'integer' }, grammar_id: STRING },
				required: ['q', 'choices', 'answer', 'grammar_id']
			}
		}
	},
	required: ['title', 'sentences', 'used_grammar', 'questions']
};

const dictForm = (key: string) => key.split('|')[0];
const describeGrammar = (p: GrammarPoint) => `${p.id}: ${p.name}. ${p.prompt_hint}`;

const POLITENESS_RULES: Record<Politeness, string> = {
	polite: '- Use です/ます (polite) forms throughout.',
	plain: '- Use plain forms (だ, dictionary and た forms) throughout, not です/ます.',
	mixed:
		'- Mix politeness as Japanese speakers do: です/ます forms in narration and with strangers or seniors, plain forms between friends and family.'
};

export function passagePrompt(request: PassageRequest): string {
	const allowed = [...new Set([...request.allowedWords].map(dictForm))];
	const dialogue = request.format === 'dialogue';
	const lines = [
		`Write a short Japanese ${dialogue ? 'dialogue' : 'prose passage'} for a beginner learner about ${request.topic}.`,
		'',
		'Rules:',
		dialogue
			? `- Write exactly ${request.sentenceCount} lines of conversation between two people, each with a natural English translation. Start each line with the speaker's name and a colon (田中：…), in both languages.`
			: `- Write exactly ${request.sentenceCount} sentences, each with a natural English translation.`,
		'- Write natural Japanese in normal kanji and kana. Do not add furigana or readings.',
		POLITENESS_RULES[request.politeness],
		'- Use only words from the allowed vocabulary below, conjugated as needed. Particles, numbers and people’s names are fine.',
		'- Give the passage a short Japanese title.',
		'- Write 1–2 multiple-choice comprehension questions in English (3 choices each) that can only be answered by understanding the target grammar. Set grammar_id to the grammar point the question tests and answer to the index of the correct choice.',
		'- List the ids of the target grammar points you used in used_grammar.',
		'',
		`Allowed vocabulary: ${allowed.length ? allowed.join('、') : '(none yet: use only the most basic beginner words)'}`
	];
	if (request.newWords.length) {
		lines.push(
			'',
			`You may also introduce these new words, using each at least once if it fits: ${request.newWords.map((w) => `${dictForm(w.key)} (${w.gloss})`).join('、')}`
		);
	}
	if (request.dueWords.length) {
		lines.push('', `Use each of these words at least once: ${request.dueWords.map(dictForm).join('、')}`);
	}
	if (request.targetGrammar.length) {
		lines.push('', 'Use every one of these grammar points at least once:', ...request.targetGrammar.map((p) => `- ${describeGrammar(p)}`));
	}
	return lines.join('\n');
}

/** What was wrong with the previous attempt, so the next one can fix exactly that. */
export interface Revision {
	previous: PassageDraft;
	incidentalWords: string[];
	missingGrammar: GrammarPoint[];
}

export function revisionPrompt(request: PassageRequest, revision: Revision): string {
	const lines = [
		passagePrompt(request),
		'',
		'Your previous passage was:',
		...revision.previous.sentences.map((s) => s.jp),
		'',
		'Rewrite it to fix these problems, keeping everything else the same:'
	];
	if (revision.incidentalWords.length) {
		lines.push(`- Replace these words, which are not in the allowed vocabulary: ${revision.incidentalWords.join('、')}`);
	}
	for (const p of revision.missingGrammar) lines.push(`- This grammar is missing, so use it: ${describeGrammar(p)}`);
	return lines.join('\n');
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';

/** Check a model reply has the shape the app relies on; throws if it doesn't. */
export function parsePassageDraft(value: unknown): PassageDraft {
	if (!isObject(value)) throw new Error('Passage reply is not an object');
	const { title, sentences, used_grammar = [], questions = [] } = value;
	if (!Array.isArray(sentences) || !sentences.length) throw new Error('Passage reply has no sentences');
	for (const s of sentences) {
		if (!isObject(s) || !isString(s.jp) || !s.jp.trim() || !isString(s.en)) throw new Error('Passage reply has a malformed sentence');
	}
	if (!Array.isArray(used_grammar) || !used_grammar.every(isString)) throw new Error('Passage reply has malformed used_grammar');
	if (!Array.isArray(questions)) throw new Error('Passage reply has malformed questions');
	const validQuestions = questions.filter(
		(q): q is PassageQuestion =>
			isObject(q) &&
			isString(q.q) &&
			Array.isArray(q.choices) &&
			q.choices.every(isString) &&
			Number.isInteger(q.answer) &&
			(q.answer as number) >= 0 &&
			(q.answer as number) < q.choices.length &&
			isString(q.grammar_id)
	);
	return {
		title: isString(title) ? title : '',
		sentences: sentences.map((s) => ({ jp: s.jp, en: s.en })),
		used_grammar,
		questions: validQuestions
	};
}

// Lesson AI panel (SPEC §5.6): explaining highlighted text, and a short quiz on the lesson.

/** Keeps a stray select-all from sending the whole lesson. */
export const MAX_SELECTION_CHARS = 600;
const MAX_CONTEXT_CHARS = 1500;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

export interface ExplainRequest {
	/** The text the learner highlighted. */
	selection: string;
	/** The paragraph (or table row, list item…) the selection sits in. */
	context: string;
	lessonTitle: string;
	/** Titles of the lessons the learner has completed, in order, so the answer builds on them. */
	completedLessons: string[];
}

/** A word or chunk of the selection, glossed. */
export interface ExplanationPart {
	text: string;
	reading: string;
	meaning: string;
}

export interface Explanation {
	explanation: string;
	parts: ExplanationPart[];
}

export const EXPLANATION_SCHEMA = {
	type: 'object',
	properties: {
		explanation: STRING,
		parts: {
			type: 'array',
			items: {
				type: 'object',
				properties: { text: STRING, reading: STRING, meaning: STRING },
				required: ['text', 'reading', 'meaning']
			}
		}
	},
	required: ['explanation', 'parts']
};

export function explainPrompt(request: ExplainRequest): string {
	const done = request.completedLessons;
	return [
		`A beginner learning Japanese with Tae Kim's Guide to Learning Japanese is reading the lesson “${request.lessonTitle}” and highlighted a part they find confusing.`,
		done.length
			? `They have completed these lessons so far: ${done.join('; ')}. You can build on that grammar, but don't assume anything beyond it.`
			: 'They have not completed any lessons yet, so assume only kana.',
		'',
		'Explain the highlighted text in plain English, in the context of this lesson:',
		'- Say what it means and why it is written that way, focusing on the grammar point the lesson is teaching.',
		'- Keep it short: at most 3 short paragraphs, separated by blank lines. No markdown headings, bold or bullet lists.',
		'- If the highlight contains Japanese, break it into its words and particles in parts, in order, each with its reading in hiragana and a short meaning or function. Leave parts empty for English-only text.',
		'',
		`Highlighted text: ${clip(request.selection.trim(), MAX_SELECTION_CHARS)}`,
		'',
		`Surrounding text: ${clip(request.context.trim(), MAX_CONTEXT_CHARS)}`
	].join('\n');
}

/** Check an explanation reply; throws if it has no explanation, and drops malformed parts. */
export function parseExplanation(value: unknown): Explanation {
	if (!isObject(value) || !isString(value.explanation) || !value.explanation.trim()) {
		throw new Error('Explanation reply has no explanation');
	}
	const parts = Array.isArray(value.parts) ? value.parts : [];
	return {
		explanation: value.explanation.trim(),
		parts: parts
			.filter((p) => isObject(p) && isString(p.text) && p.text.trim() && isString(p.meaning))
			.map((p) => ({ text: p.text, reading: isString(p.reading) ? p.reading : '', meaning: p.meaning }))
	};
}

/** How many questions "Quiz me" asks. */
export const QUIZ_LENGTH = 3;

export interface QuizQuestion {
	q: string;
	choices: string[];
	/** Index into `choices`. */
	answer: number;
	/** Why the answer is right, shown once the learner has answered. */
	explanation: string;
}

export const QUIZ_SCHEMA = {
	type: 'object',
	properties: {
		questions: {
			type: 'array',
			items: {
				type: 'object',
				properties: { q: STRING, choices: STRINGS, answer: { type: 'integer' }, explanation: STRING },
				required: ['q', 'choices', 'answer', 'explanation']
			}
		}
	},
	required: ['questions']
};

export interface QuizRequest {
	lessonTitle: string;
	/** The lesson as plain text (lessons.ts lessonText), already cut to a sensible length. */
	lessonText: string;
	/** The grammar points the lesson teaches, if any. */
	grammar: GrammarPoint[];
}

export function quizPrompt(request: QuizRequest): string {
	const lines = [
		`Write a quick ${QUIZ_LENGTH}-question multiple-choice check on the Japanese lesson “${request.lessonTitle}” from Tae Kim's Guide to Learning Japanese, for a beginner who has just read it.`,
		'',
		'Rules:',
		`- Write exactly ${QUIZ_LENGTH} questions in English, each testing a different point the lesson teaches. Japanese in questions and choices is fine, using only words and grammar from the lesson.`,
		'- Give each question 3 or 4 choices with exactly one correct answer; make the wrong choices mistakes a learner would plausibly make.',
		'- Set answer to the index of the correct choice.',
		'- In explanation, say in one or two sentences why the answer is right.'
	];
	if (request.grammar.length) {
		lines.push('', 'The lesson teaches these grammar points:', ...request.grammar.map((p) => `- ${p.name}. ${p.prompt_hint}`));
	}
	lines.push('', 'The lesson:', request.lessonText);
	return lines.join('\n');
}

/**
 * Check a quiz reply: drop malformed questions (a choice list without a valid answer, or repeated
 * choices that would make two answers look right) and keep at most QUIZ_LENGTH. Throws if none survive.
 */
export function parseQuiz(value: unknown): QuizQuestion[] {
	if (!isObject(value) || !Array.isArray(value.questions)) throw new Error('Quiz reply has no questions');
	const questions = value.questions
		.filter(
			(q): q is QuizQuestion =>
				isObject(q) &&
				isString(q.q) &&
				q.q.trim() !== '' &&
				Array.isArray(q.choices) &&
				q.choices.length >= 2 &&
				q.choices.every(isString) &&
				new Set(q.choices.map((c) => c.trim())).size === q.choices.length &&
				Number.isInteger(q.answer) &&
				(q.answer as number) >= 0 &&
				(q.answer as number) < q.choices.length
		)
		.slice(0, QUIZ_LENGTH)
		.map((q) => ({ q: q.q, choices: q.choices, answer: q.answer, explanation: isString(q.explanation) ? q.explanation : '' }));
	if (!questions.length) throw new Error('Quiz reply has no usable questions');
	return questions;
}

/** The question with its choices shuffled, since models tend to put the right answer first. */
export function shuffleChoices(question: QuizQuestion, random: () => number = Math.random): QuizQuestion {
	const order = question.choices.map((_, i) => i);
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	return { ...question, choices: order.map((i) => question.choices[i]), answer: order.indexOf(question.answer) };
}
