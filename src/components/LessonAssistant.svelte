<script lang="ts" module>
	/** The block (paragraph, list item, table row…) a node sits in, for the text around a highlight. */
	function enclosingBlock(node: Node, root: HTMLElement): HTMLElement {
		const element = node instanceof HTMLElement ? node : node.parentElement;
		const block = element?.closest('p, li, tr, blockquote, h2, h3, h4, dd, dt, table, div');
		return block instanceof HTMLElement && root.contains(block) ? block : root;
	}
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { loadApiKey } from '../lib/ai/api-key';
	import { MAX_SELECTION_CHARS, type Explanation, type QuizQuestion } from '../lib/ai/prompts';
	import { loadLessonProgress } from '../lib/db/lessons';
	import { explainSelection, quizOnLesson } from '../lib/lessons/assistant';
	import type { Lesson, LessonSummary } from '../lib/lessons/lessons';
	import QuestionCard from './QuestionCard.svelte';

	interface Props {
		lesson: Lesson;
		/** All lessons, to name the ones the learner has completed. */
		index: LessonSummary[];
		/** The rendered lesson body; only highlights inside it can be explained. */
		article: HTMLElement | undefined;
		signedIn: boolean;
	}

	let { lesson, index, article, signedIn }: Props = $props();

	// The latest highlight in the lesson. Kept when the selection collapses, so tapping Explain on a
	// phone (which can clear the selection first) still has something to explain.
	let selection = $state<{ text: string; context: string } | null>(null);

	type Panel =
		| { kind: 'idle' }
		| { kind: 'busy'; text: string }
		| { kind: 'error'; text: string }
		| { kind: 'explanation'; selection: string; explanation: Explanation }
		| { kind: 'quiz'; questions: QuizQuestion[]; chosen: (number | null)[] };

	let panel = $state<Panel>({ kind: 'idle' });

	$effect(() => {
		// A new lesson starts with a clean panel.
		void lesson.id;
		selection = null;
		panel = { kind: 'idle' };
	});

	$effect(() => {
		const root = article;
		if (!root) return;
		const onChange = () => {
			const sel = document.getSelection();
			if (!sel || sel.isCollapsed || !sel.rangeCount) return;
			const range = sel.getRangeAt(0);
			if (!root.contains(range.commonAncestorContainer)) return;
			const text = sel.toString().replace(/\s+/g, ' ').trim();
			if (!text) return;
			selection = { text, context: enclosingBlock(range.commonAncestorContainer, root).innerText };
		};
		document.addEventListener('selectionchange', onChange);
		return () => document.removeEventListener('selectionchange', onChange);
	});

	function apiKeyOrComplain(): string | null {
		const apiKey = loadApiKey();
		if (!apiKey) panel = { kind: 'error', text: 'Add your Gemini API key in Settings first.' };
		return apiKey || null;
	}

	/** Titles of the completed lessons in order; none if signed out or it can't load. */
	async function completedLessons(): Promise<string[]> {
		if (!signedIn) return [];
		const progress = await loadLessonProgress().catch(() => []);
		const done = new Set(progress.filter((p) => p.completed_at).map((p) => p.lesson_id));
		return index.filter((l) => done.has(l.id)).toSorted((a, b) => a.order - b.order).map((l) => l.title);
	}

	async function explain() {
		const chosen = selection;
		const apiKey = apiKeyOrComplain();
		if (!chosen || !apiKey) return;
		const lessonId = lesson.id;
		panel = { kind: 'busy', text: 'Explaining…' };
		try {
			const explanation = await explainSelection(apiKey, {
				selection: chosen.text,
				context: chosen.context,
				lessonTitle: lesson.title,
				completedLessons: await completedLessons()
			});
			if (lesson.id === lessonId) panel = { kind: 'explanation', selection: chosen.text, explanation };
		} catch (err) {
			if (lesson.id === lessonId) panel = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
		}
	}

	async function startQuiz() {
		const apiKey = apiKeyOrComplain();
		if (!apiKey) return;
		const lessonId = lesson.id;
		panel = { kind: 'busy', text: 'Writing a quiz…' };
		try {
			const questions = await quizOnLesson(apiKey, lesson);
			if (lesson.id === lessonId) panel = { kind: 'quiz', questions, chosen: questions.map(() => null) };
		} catch (err) {
			if (lesson.id === lessonId) panel = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
		}
	}

	const busy = $derived(panel.kind === 'busy');
	const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
	const clipped = (text: string) => (text.length > 120 ? `${text.slice(0, 120)}…` : text);
</script>

<aside class="assistant" aria-label="Lesson assistant">
	<div class="actions">
		<!-- preventDefault on mousedown keeps the highlight while the button is pressed. -->
		<button onmousedown={(e) => e.preventDefault()} onclick={explain} disabled={busy || !selection}>Explain</button>
		<button onmousedown={(e) => e.preventDefault()} onclick={startQuiz} disabled={busy}>Quiz me</button>
		{#if panel.kind !== 'idle' && !busy}
			<button class="close" onclick={() => (panel = { kind: 'idle' })} aria-label="Close">×</button>
		{/if}
	</div>

	{#if selection}
		<p class="selection">
			<span class="muted">Selected:</span> <span lang="ja">{clipped(selection.text)}</span>
			{#if selection.text.length > MAX_SELECTION_CHARS}<span class="muted">(only the start is explained)</span>{/if}
		</p>
	{:else if panel.kind === 'idle'}
		<p class="muted">Highlight anything in the lesson and press Explain, or test yourself with a quick quiz.</p>
	{/if}

	<div class="body">
		{#if panel.kind === 'busy'}
			<p class="muted">{panel.text}</p>
		{:else if panel.kind === 'error'}
			<p class="error">
				{panel.text}
				{#if panel.text.includes('Settings')}<a href={resolve('/settings')}>Open Settings</a>{/if}
			</p>
		{:else if panel.kind === 'explanation'}
			<p class="quote" lang="ja">{clipped(panel.selection)}</p>
			{#each paragraphs(panel.explanation.explanation) as paragraph, i (i)}
				<p>{paragraph}</p>
			{/each}
			{#if panel.explanation.parts.length}
				<dl>
					{#each panel.explanation.parts as part, i (i)}
						<dt lang="ja">
							{part.text}{#if part.reading && part.reading !== part.text}<span class="reading">{part.reading}</span>{/if}
						</dt>
						<dd>{part.meaning}</dd>
					{/each}
				</dl>
			{/if}
		{:else if panel.kind === 'quiz'}
			{@const quiz = panel}
			{#each quiz.questions as question, i (i)}
				<QuestionCard {question} chosen={quiz.chosen[i]} onanswer={(choice) => (quiz.chosen[i] = choice)} />
			{/each}
			{#if quiz.chosen.every((c) => c !== null)}
				<p>
					<strong>{quiz.chosen.filter((c, i) => c === quiz.questions[i].answer).length} of {quiz.questions.length}</strong>
					correct.
					<button onclick={startQuiz}>New quiz</button>
				</p>
			{/if}
		{/if}
	</div>
</aside>

<style>
	.assistant {
		border: 1px solid #ddd;
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		background: #fafafa;
		font-size: 0.95rem;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.close {
		margin-left: auto;
		border: none;
		background: none;
		font-size: 1.25rem;
		cursor: pointer;
	}
	.selection,
	.quote {
		margin: 0.5rem 0;
		overflow-wrap: anywhere;
	}
	.quote {
		border-left: 3px solid #ddd;
		padding-left: 0.5rem;
	}
	.body :global(p) {
		margin: 0.5rem 0;
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.25rem 0.75rem;
		margin: 0.75rem 0 0;
	}
	dt {
		font-weight: 600;
	}
	dd {
		margin: 0;
	}
	.reading {
		margin-left: 0.4rem;
		font-weight: normal;
		color: #666;
		font-size: 0.85em;
	}
	.muted {
		color: #666;
	}
	.error {
		color: #b00020;
	}
</style>
