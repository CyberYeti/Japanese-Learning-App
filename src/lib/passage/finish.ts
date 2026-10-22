// Browser glue for "Done": the reader's taps and answers → FSRS ratings → saved items and review log.
import type { StoredPassage } from '../db/passages';
import { loadScheduledItems, recordPassageReview } from '../db/reviews';
import { analyze } from '../nlp/tokenizer-client';
import { applyGrades, gradePassage, type ItemGrade, type QuestionAnswer } from '../srs/grading';
import { staticJson } from '../static-data';
import { aliasKeys, type VocabWord } from '../vocab/vocab';

/** Where a tapped word's head token sits in the passage. */
export interface TokenPosition {
	sentence: number;
	token: number;
}

export interface FinishResult {
	grades: ItemGrade[];
	/** False if the passage had already been graded, in which case nothing was saved. */
	saved: boolean;
}

export async function finishPassage(
	passage: StoredPassage,
	tapped: Iterable<TokenPosition>,
	answers: QuestionAnswer[]
): Promise<FinishResult> {
	const [n5, lessonWords, sentenceKeys] = await Promise.all([
		staticJson<VocabWord[]>('data/vocab/n5.json'),
		staticJson<VocabWord[]>('data/vocab/lessons.json'),
		loadSentenceKeys(passage)
	]);
	const aliases = aliasKeys([...n5, ...lessonWords]);
	const canonical = (key: string) => aliases.get(key) ?? key;

	const tappedKeys = [...tapped].map((p) => sentenceKeys[p.sentence]?.[p.token]).filter((k) => k != null);
	const keys = sentenceKeys.flat().filter((k) => k !== null).map(canonical);
	const items = await loadScheduledItems([...keys, ...answers.map((a) => a.grammar_id)]);

	const now = new Date();
	const grades = gradePassage({ sentenceKeys, tapped: tappedKeys, answers, items, canonical, now });
	const saved = await recordPassageReview(passage.id, applyGrades(items, grades, now), grades, now);
	return { grades, saved };
}

/** Vocab keys per sentence; passages saved before keys were stored are re-analyzed. */
function loadSentenceKeys(passage: StoredPassage): Promise<(string | null)[][]> {
	return Promise.all(
		passage.content.sentences.map(async (s) => s.keys ?? (await analyze(s.jp)).keys)
	);
}
