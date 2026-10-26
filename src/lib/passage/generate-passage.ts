// Steps 2–4 of passage generation (SPEC §5.3): ask the model, check the draft in code, retry with
// specific feedback, and keep the best of at most 3 attempts.
import { IncompleteReplyError } from '../ai/generate';
import { parsePassageDraft, passagePrompt, revisionPrompt, type DraftSentence, type PassageDraft } from '../ai/prompts';
import type { Analysis } from '../nlp/content';
import { measureCoverage } from '../nlp/coverage';
import { matches } from '../nlp/grammar';
import type { Token } from '../nlp/tokenize';
import type { PassageRequest } from './request';

export interface GenerateDeps {
	/** Send a prompt to the model and return its parsed JSON reply. */
	generate(prompt: string): Promise<unknown>;
	analyze(text: string): Promise<Analysis>;
	/** Called before each model call, with the 1-based attempt number. */
	onAttempt?(attempt: number): void;
}

export interface GenerateOptions {
	/** Coverage needed to accept a draft without retrying. */
	minCoverage?: number;
	maxAttempts?: number;
}

export interface CheckedSentence extends DraftSentence {
	tokens: Token[];
	/** Lines up with `tokens` (Analysis.keys), so grading can check which items occur without a tokenizer. */
	keys: (string | null)[];
}

export interface CheckedPassage {
	draft: PassageDraft;
	sentences: CheckedSentence[];
	coverage: number;
	/** Dictionary forms of the words outside the learner's vocabulary (incidental vocabulary). */
	incidental: string[];
	/** Ids of target grammar points no sentence matched. */
	missingGrammar: string[];
	/** Vocab keys of the request's new words that the passage uses: the words it introduces. */
	newWords: string[];
	/** Whether it met the coverage threshold with all target grammar, rather than being the best of a bad lot. */
	accepted: boolean;
	attempts: number;
}

export const DEFAULT_MIN_COVERAGE = 0.95;
/** At most 3 model calls per passage (SPEC §5.3 budget). */
export const MAX_ATTEMPTS = 3;

export async function generatePassage(
	request: PassageRequest,
	deps: GenerateDeps,
	{ minCoverage = DEFAULT_MIN_COVERAGE, maxAttempts = MAX_ATTEMPTS }: GenerateOptions = {}
): Promise<CheckedPassage> {
	let best: Checked | null = null;
	let last: Checked | null = null;
	let attempt = 0;

	while (attempt < maxAttempts && !last?.accepted) {
		attempt++;
		deps.onAttempt?.(attempt);
		const prompt = last
			? revisionPrompt(request, {
					previous: last.draft,
					incidentalWords: last.incidental,
					missingGrammar: request.targetGrammar.filter((p) => last!.missingGrammar.includes(p.id))
				})
			: passagePrompt(request);

		// A cut-off or malformed reply uses up the attempt, and the next one sends the same prompt again.
		let reply: unknown;
		try {
			reply = await deps.generate(prompt);
		} catch (err) {
			if (err instanceof IncompleteReplyError) continue;
			// Asking again won't fix a request error (bad key, rate limit): keep the best draft so far, if any.
			if (best) break;
			throw err;
		}
		let draft: PassageDraft;
		try {
			draft = parsePassageDraft(reply);
		} catch {
			continue;
		}

		last = await check(draft, request, deps, minCoverage);
		if (!best || better(last, best)) best = last;
	}

	if (!best) throw new Error(`The model gave no usable passage in ${maxAttempts} attempts.`);
	return { ...best, attempts: attempt };
}

async function check(
	draft: PassageDraft,
	request: PassageRequest,
	deps: GenerateDeps,
	minCoverage: number
): Promise<Checked> {
	const analyses = await Promise.all(draft.sentences.map((s) => deps.analyze(s.jp)));
	// New words are allowed too: the passage is where they're introduced.
	const spellings = request.newWords.map((w) => ({ key: w.key, all: [w.key, ...w.aliases] }));
	const allowed = new Set([...request.allowedWords, ...spellings.flatMap((w) => w.all)]);
	const { coverage, incidental } = measureCoverage(analyses, allowed);
	const used = new Set(analyses.flatMap((a) => a.keys));
	// Matchers run per sentence: a grammar pattern never spans two sentences.
	const missingGrammar = request.targetGrammar
		.filter((p) => !analyses.some((a) => matches(p.matcher, a.tokens)))
		.map((p) => p.id);
	return {
		draft,
		sentences: draft.sentences.map((s, i) => ({ ...s, tokens: analyses[i].tokens, keys: analyses[i].keys })),
		coverage,
		incidental,
		missingGrammar,
		newWords: spellings.filter((w) => w.all.some((k) => used.has(k))).map((w) => w.key),
		// With no words learned yet every word is incidental, and no rewrite could fix that.
		accepted: (coverage >= minCoverage || request.allowedWords.size === 0) && !missingGrammar.length
	};
}

type Checked = Omit<CheckedPassage, 'attempts'>;

/** Target grammar matters more than coverage: a stray incidental word just becomes tap-to-define. */
const better = (a: Checked, b: Checked) =>
	a.missingGrammar.length !== b.missingGrammar.length
		? a.missingGrammar.length < b.missingGrammar.length
		: a.coverage > b.coverage;
