<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { completeLesson, startLesson, type LessonProgress } from '../../../lib/db/lessons';
	import { supabase } from '../../../lib/db/supabase';
	import { adjacentLessons, anchorHeadings, lessonItems, type Lesson, type LessonSummary } from '../../../lib/lessons/lessons';
	import type { GrammarPoint } from '../../../lib/nlp/grammar';
	import { staticJson, type StaticPath } from '../../../lib/static-data';
	import type { VocabWord } from '../../../lib/vocab/vocab';

	let lesson = $state.raw<Lesson | null>(null);
	let index = $state.raw<LessonSummary[]>([]);
	let signedIn = $state(false);
	let progress = $state<LessonProgress | null>(null);
	let status = $state<{ kind: 'loading' | 'error'; text: string } | null>({ kind: 'loading', text: 'Loading lesson…' });
	let completing = $state(false);
	let progressError = $state<string | null>(null);
	let added = $state<number | null>(null);

	$effect(() => {
		const id = page.params.id!;
		lesson = null;
		progress = null;
		added = null;
		progressError = null;
		status = { kind: 'loading', text: 'Loading lesson…' };
		let stale = false;
		Promise.all([
			staticJson<LessonSummary[]>('data/lessons/index.json'),
			supabase.auth.getSession()
		])
			.then(async ([lessons, { data }]) => {
				if (stale) return;
				index = lessons;
				if (!lessons.some((l) => l.id === id)) {
					status = { kind: 'error', text: 'Lesson not found.' };
					return;
				}
				const found = await staticJson<Lesson>(`data/lessons/${id}.json` as StaticPath);
				if (stale) return;
				lesson = found;
				status = null;
				signedIn = Boolean(data.session);
				// The lesson stays readable if progress can't be saved; the error shows by Mark complete.
				if (signedIn) {
					try {
						const row = await startLesson(id);
						if (!stale) progress = row;
					} catch (err) {
						if (!stale) progressError = err instanceof Error ? err.message : String(err);
					}
				}
			})
			.catch((err) => {
				if (!stale) status = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
			});
		return () => (stale = true);
	});

	const body = $derived(lesson ? anchorHeadings(lesson.html) : { html: '', headings: [] });
	const adjacent = $derived(lesson ? adjacentLessons(index, lesson.id) : { prev: null, next: null });

	async function markComplete() {
		if (!lesson) return;
		completing = true;
		progressError = null;
		try {
			const [grammarPoints, n5, lessonWords] = await Promise.all([
				staticJson<GrammarPoint[]>('data/grammar_points.json'),
				staticJson<VocabWord[]>('data/vocab/n5.json'),
				staticJson<VocabWord[]>('data/vocab/lessons.json')
			]);
			const items = lessonItems(lesson, grammarPoints, [...n5, ...lessonWords]);
			({ progress, added } = await completeLesson(lesson.id, items));
		} catch (err) {
			progressError = err instanceof Error ? err.message : String(err);
		} finally {
			completing = false;
		}
	}
</script>

<svelte:head><title>{lesson?.title ?? 'Lesson'} · Japanese Learning App</title></svelte:head>

<main>
	<p><a href={resolve('/')}>← Home</a> · <a href={resolve('/lessons')}>All lessons</a></p>

	{#if status}
		<p class={status.kind}>{status.text}</p>
	{/if}

	{#if lesson}
		<p class="muted">{lesson.section}</p>
		<h1>{lesson.title}</h1>
		<p class="attribution">
			From <a href={lesson.source_url}>“{lesson.title}”</a> in Tae Kim's Guide to Learning Japanese, licensed
			<a href="https://creativecommons.org/licenses/by-nc-sa/3.0/us/">CC BY-NC-SA 3.0 US</a>. Adapted: navigation,
			videos and exercises removed.
		</p>

		{#if body.headings.length > 1}
			<nav aria-label="Contents">
				<ol>
					{#each body.headings as heading (heading.id)}
						<li><a href="#{heading.id}">{heading.title}</a></li>
					{/each}
				</ol>
			</nav>
		{/if}

		<!-- Trusted: our own import of the lesson (scripts/import_taekim.py), served from static/. -->
		<article lang="en">{@html body.html}</article>

		<section class="complete">
			{#if progress?.completed_at}
				<p class="done">✓ Completed {new Date(progress.completed_at).toLocaleDateString()}</p>
				{#if added !== null}
					<p class="muted">{added} new grammar points and words are now in your reviews.</p>
				{/if}
			{:else if signedIn}
				<button onclick={markComplete} disabled={completing}>
					{completing ? 'Saving…' : 'Mark complete'}
				</button>
				<span class="muted">Adds this lesson's grammar and words to your reviews.</span>
			{:else}
				<p class="muted"><a href={resolve('/')}>Sign in</a> to mark lessons complete.</p>
			{/if}
			{#if progressError}
				<p class="error">{progressError}</p>
			{/if}
		</section>

		<nav class="pager" aria-label="Lessons">
			{#if adjacent.prev}
				<a href={resolve('/lessons/[id]', { id: adjacent.prev.id })}>← {adjacent.prev.title}</a>
			{:else}<span></span>{/if}
			{#if adjacent.next}
				<a href={resolve('/lessons/[id]', { id: adjacent.next.id })}>{adjacent.next.title} →</a>
			{/if}
		</nav>
	{/if}
</main>

<style>
	main {
		max-width: 40rem;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
		line-height: 1.6;
	}
	h1 {
		margin-top: 0;
	}
	.attribution {
		font-size: 0.85rem;
		color: #555;
		border-left: 3px solid #ddd;
		padding-left: 0.75rem;
	}
	nav ol {
		padding-left: 1.25rem;
	}
	article :global(table) {
		border-collapse: collapse;
		margin: 1rem 0;
	}
	article :global(th),
	article :global(td) {
		border: 1px solid #ccc;
		padding: 0.25rem 0.5rem;
	}
	article :global(h2) {
		scroll-margin-top: 1rem;
	}
	.complete {
		margin: 2rem 0;
		padding-top: 1rem;
		border-top: 1px solid #ddd;
	}
	.pager {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.done {
		color: #1b7f3b;
		font-weight: 600;
	}
	.loading,
	.muted {
		color: #666;
	}
	.error {
		color: #b00020;
	}
</style>
