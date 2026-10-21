// Coverage (CONTEXT.md): how much of a passage is made of words the learner already has.
import { isContentToken, type Analysis } from './content';

export interface CoverageResult {
	/** Allowed content tokens / all content tokens, counting every occurrence. */
	coverage: number;
	/** Dictionary forms of the content words not allowed, each once, in first-seen order. */
	incidental: string[];
}

export function measureCoverage(texts: Analysis[], allowed: Set<string>): CoverageResult {
	let total = 0;
	let covered = 0;
	const incidental = new Set<string>();
	for (const { tokens, keys } of texts) {
		tokens.forEach((token, i) => {
			if (!isContentToken(token)) return;
			total++;
			const key = keys[i];
			if (key && allowed.has(key)) covered++;
			else incidental.add(token.basicForm);
		});
	}
	return { coverage: total ? covered / total : 1, incidental: [...incidental] };
}
