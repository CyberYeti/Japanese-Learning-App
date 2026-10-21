<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { loadLessonProgress } from '../../lib/db/lessons';
	import { supabase } from '../../lib/db/supabase';
	import type { LessonSummary } from '../../lib/lessons/lessons';
	import { staticJson } from '../../lib/static-data';

	let lessons = $state<LessonSummary[]>([]);
	let completed = $state(new Set<string>());
	let error = $state<string | null>(null);

	const sections = $derived(
		Map.groupBy(
			lessons.toSorted((a, b) => a.order - b.order),
			(l) => l.section
		)
	);

	onMount(async () => {
		try {
			lessons = await staticJson<LessonSummary[]>('data/lessons/index.json');
			const { data } = await supabase.auth.getSession();
			if (data.session) {
				const progress = await loadLessonProgress();
				completed = new Set(progress.filter((p) => p.completed_at).map((p) => p.lesson_id));
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	});
</script>

<svelte:head><title>Lessons · Japanese Learning App</title></svelte:head>

<main>
	<p><a href={resolve('/')}>← Home</a></p>
	<h1>Lessons</h1>
	<p class="muted">
		From <a href="https://guidetojapanese.org/learn/grammar">Tae Kim's Guide to Learning Japanese</a>, CC BY-NC-SA
		3.0 US.
	</p>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#each sections as [section, sectionLessons] (section)}
		<h2>{section}</h2>
		<ol>
			{#each sectionLessons as lesson (lesson.id)}
				<li>
					<a href={resolve('/lessons/[id]', { id: lesson.id })}>{lesson.title}</a>
					{#if completed.has(lesson.id)}<span class="done" title="Completed">✓</span>{/if}
				</li>
			{/each}
		</ol>
	{/each}
</main>

<style>
	main {
		max-width: 40rem;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	li {
		margin: 0.3rem 0;
	}
	.done {
		color: #1b7f3b;
		margin-left: 0.4rem;
	}
	.muted {
		color: #666;
	}
	.error {
		color: #b00020;
	}
</style>
