// Browser glue for the lesson AI panel (SPEC §5.6): "Explain" a highlight, and "Quiz me".
import { generateJson, IncompleteReplyError } from '../ai/generate';
import {
	EXPLANATION_SCHEMA,
	explainPrompt,
	parseExplanation,
	parseQuiz,
	QUIZ_SCHEMA,
	quizPrompt,
	shuffleChoices,
	type ExplainRequest,
	type Explanation,
	type QuizQuestion
} from '../ai/prompts';
import type { GrammarPoint } from '../nlp/grammar';
import { staticJson } from '../static-data';
import { lessonText, type Lesson } from './lessons';

/** Every Basic Grammar lesson fits whole (the longest is about 12,000 characters as text). */
const QUIZ_LESSON_CHARS = 12000;

/**
 * Ask once, and once more if the reply comes back cut off or malformed. The learner is waiting on
 * both calls, so they use the faster model.
 */
async function ask<T>(apiKey: string, prompt: string, schema: object, parse: (value: unknown) => T): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return parse(await generateJson(prompt, schema, { apiKey, priority: 'speed' }));
		} catch (err) {
			if (attempt >= 2 || !(err instanceof IncompleteReplyError)) throw err;
		}
	}
}

export function explainSelection(apiKey: string, request: ExplainRequest): Promise<Explanation> {
	return ask(apiKey, explainPrompt(request), EXPLANATION_SCHEMA, parseExplanation);
}

export async function quizOnLesson(apiKey: string, lesson: Pick<Lesson, 'id' | 'title' | 'html'>): Promise<QuizQuestion[]> {
	const grammarPoints = await staticJson<GrammarPoint[]>('data/grammar_points.json');
	const prompt = quizPrompt({
		lessonTitle: lesson.title,
		lessonText: lessonText(lesson.html, QUIZ_LESSON_CHARS),
		grammar: grammarPoints.filter((p) => p.lesson_id === lesson.id)
	});
	const questions = await ask(apiKey, prompt, QUIZ_SCHEMA, parseQuiz);
	return questions.map((q) => shuffleChoices(q));
}
