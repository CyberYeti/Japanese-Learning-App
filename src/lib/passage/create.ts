// Browser glue for "generate a passage": static data + learner state → request → checked passage → saved row.
import { asset } from '$app/paths';
import { generateJson } from '../ai/generate';
import { PASSAGE_SCHEMA } from '../ai/prompts';
import { loadLearnerState, savePassage } from '../db/passages';
import type { GrammarPoint } from '../nlp/grammar';
import { analyze } from '../nlp/tokenizer-client';
import type { VocabWord } from '../vocab/vocab';
import { generatePassage } from './generate-passage';
import { buildPassageRequest } from './request';

async function staticJson<T>(path: Parameters<typeof asset>[0]): Promise<T> {
	const res = await fetch(asset(path));
	if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
	return res.json();
}

export interface CreateOptions {
	apiKey: string;
	onAttempt?(attempt: number): void;
}

/** Generate, check and save a passage; returns the new passage's id. */
export async function createPassage({ apiKey, onAttempt }: CreateOptions): Promise<string> {
	const [grammarPoints, lessons, n5, lessonWords, learner] = await Promise.all([
		staticJson<GrammarPoint[]>('data/grammar_points.json'),
		staticJson<{ id: string; order: number }[]>('data/lessons/index.json'),
		staticJson<VocabWord[]>('data/vocab/n5.json'),
		staticJson<VocabWord[]>('data/vocab/lessons.json'),
		loadLearnerState()
	]);
	const request = buildPassageRequest({
		...learner,
		lessons,
		grammarPoints,
		vocab: [...n5, ...lessonWords],
		now: new Date()
	});
	const passage = await generatePassage(
		request,
		{ generate: (prompt) => generateJson(prompt, PASSAGE_SCHEMA, { apiKey }), analyze, onAttempt }
	);
	return savePassage(request, passage);
}
