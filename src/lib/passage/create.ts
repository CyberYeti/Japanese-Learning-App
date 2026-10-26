// Browser glue for "generate a passage": static data + learner state + settings → request → checked
// passage → saved row, plus the new words it introduces.
import { generateJson, type Priority } from '../ai/generate';
import { PASSAGE_SCHEMA } from '../ai/prompts';
import { introduceWords, loadLearnerState, savePassage } from '../db/passages';
import { loadSettings } from '../db/settings';
import type { GrammarPoint } from '../nlp/grammar';
import { analyze } from '../nlp/tokenizer-client';
import { staticJson } from '../static-data';
import type { VocabWord } from '../vocab/vocab';
import { generatePassage } from './generate-passage';
import { buildPassageRequest } from './request';

export interface CreateOptions {
	apiKey: string;
	/** 'speed' when the reader is waiting for this passage; background generation keeps 'quality'. */
	priority?: Priority;
	onAttempt?(attempt: number): void;
}

/** Generate, check and save a passage; returns the new passage's id. */
export async function createPassage({ apiKey, priority, onAttempt }: CreateOptions): Promise<string> {
	const [grammarPoints, lessons, n5, lessonWords, learner, settings] = await Promise.all([
		staticJson<GrammarPoint[]>('data/grammar_points.json'),
		staticJson<{ id: string; order: number }[]>('data/lessons/index.json'),
		staticJson<VocabWord[]>('data/vocab/n5.json'),
		staticJson<VocabWord[]>('data/vocab/lessons.json'),
		loadLearnerState(),
		loadSettings()
	]);
	const now = new Date();
	const dayStart = new Date(now);
	dayStart.setHours(0, 0, 0, 0);
	const request = buildPassageRequest({
		...learner,
		lessons,
		grammarPoints,
		vocab: [...n5, ...lessonWords],
		settings,
		dayStart,
		now
	});
	const passage = await generatePassage(
		request,
		{ generate: (prompt) => generateJson(prompt, PASSAGE_SCHEMA, { apiKey, priority }), analyze, onAttempt },
		{ minCoverage: settings.coverage_threshold }
	);
	const id = await savePassage(request, passage);
	await introduceWords(passage.newWords);
	return id;
}
