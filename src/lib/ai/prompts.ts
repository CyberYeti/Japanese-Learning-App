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
