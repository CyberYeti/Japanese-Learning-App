<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { loadDueItems, recordReviews } from '../../lib/db/reviews';
	import { supabase } from '../../lib/db/supabase';
	import { createDictionary } from '../../lib/dict/lookup';
	import type { GrammarPoint } from '../../lib/nlp/grammar';
	import { cardFace, rateCard, requeue, vocabIndex } from '../../lib/srs/cards';
	import { Rating, type Grade, type ScheduledItem } from '../../lib/srs/scheduler';
	import { staticJson } from '../../lib/static-data';
	import type { VocabWord } from '../../lib/vocab/vocab';

	/** Cards per session; a backlog larger than this is worked through over several. */
	const SESSION_SIZE = 100;

	const dictionary = createDictionary(`${resolve('/')}data/dict`);

	const RATINGS: { rating: Grade; label: string; key: string }[] = [
		{ rating: Rating.Again, label: 'Again', key: '1' },
		{ rating: Rating.Hard, label: 'Hard', key: '2' },
		{ rating: Rating.Good, label: 'Good', key: '3' },
		{ rating: Rating.Easy, label: 'Easy', key: '4' }
	];

	let status = $state<{ kind: 'loading' | 'error' | 'signed-out'; text: string } | null>({ kind: 'loading', text: 'Loading cards…' });
	let queue = $state.raw<ScheduledItem[]>([]);
	let vocab = $state.raw(new Map<string, VocabWord>());
	let grammar = $state.raw(new Map<string, GrammarPoint>());
	let revealed = $state(false);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let reviewed = $state(0);

	onMount(async () => {
		try {
			const { data } = await supabase.auth.getSession();
			if (!data.session) {
				status = { kind: 'signed-out', text: '' };
				return;
			}
			const [due, points, n5, lessonWords] = await Promise.all([
				loadDueItems(new Date(), SESSION_SIZE),
				staticJson<GrammarPoint[]>('data/grammar_points.json'),
				staticJson<VocabWord[]>('data/vocab/n5.json'),
				staticJson<VocabWord[]>('data/vocab/lessons.json')
			]);
			vocab = vocabIndex([...n5, ...lessonWords]);
			grammar = new Map(points.map((p) => [p.id, p]));
			queue = due;
			status = null;
		} catch (err) {
			status = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
		}
	});

	const card = $derived(queue[0] ?? null);
	const face = $derived(card ? cardFace(card, vocab, grammar) : null);

	// A word missing from the vocab lists still gets a meaning, from the dictionary.
	const meaning = $derived.by(async () => {
		if (!card || !face || face.meaning || card.item_type !== 'word') return face?.meaning ?? null;
		const [entry] = await dictionary.lookup(face.front).catch(() => []);
		return entry?.senses[0]?.gloss.join('; ') ?? null;
	});

	async function rate(rating: Grade) {
		if (!card || !revealed || saving) return;
		saving = true;
		saveError = null;
		const now = new Date();
		const { updated, grade } = rateCard(card, rating, now);
		try {
			await recordReviews([updated], [grade], now);
			queue = requeue(queue, updated, now);
			revealed = false;
			reviewed++;
		} catch (err) {
			saveError = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if (!card || event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
		if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
			event.preventDefault();
			revealed = true;
		} else if (revealed) {
			const choice = RATINGS.find((r) => r.key === event.key);
			if (choice) rate(choice.rating);
		}
	}
</script>

<svelte:window {onkeydown} />

<svelte:head><title>Flashcards · Japanese Learning App</title></svelte:head>

<main>
	<p><a href={resolve('/')}>← Home</a> · <a href={resolve('/lessons')}>Lessons</a></p>
	<h1>Flashcards</h1>

	{#if status?.kind === 'signed-out'}
		<p><a href={resolve('/')}>Sign in</a> to review your cards.</p>
	{:else if status}
		<p class={status.kind}>{status.text}</p>
	{:else if card && face}
		<p class="muted">{queue.length} to go · {reviewed} reviewed</p>
		<section class="card" aria-live="polite">
			<p class="kind">{card.item_type === 'word' ? 'Word: reading and meaning?' : 'Grammar: what is this sentence using?'}</p>
			<p class="front" lang="ja">{face.front}</p>
			{#if revealed}
				<hr />
				{#if face.reading}<p class="reading" lang="ja">{face.reading}</p>{/if}
				{#await meaning then text}
					<p class="meaning">{text ?? '(no meaning found)'}</p>
				{/await}
				{#if face.note}<p class="note">{face.note}</p>{/if}
			{/if}
		</section>

		{#if revealed}
			<div class="ratings">
				{#each RATINGS as { rating, label, key } (rating)}
					<button onclick={() => rate(rating)} disabled={saving} title="Key {key}">{label}</button>
				{/each}
			</div>
		{:else}
			<button class="show" onclick={() => (revealed = true)}>Show answer</button>
		{/if}
		{#if saveError}
			<p class="error">{saveError}</p>
		{/if}
	{:else}
		<p class="done">{reviewed ? `All done: ${reviewed} reviewed.` : 'Nothing is due right now.'}</p>
		<p><a href={resolve('/')}>Back home</a></p>
	{/if}
</main>

<style>
	main {
		max-width: 32rem;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	.card {
		border: 1px solid #ddd;
		border-radius: 0.75rem;
		padding: 1.5rem 1rem;
		text-align: center;
		min-height: 10rem;
	}
	.kind {
		margin: 0;
		font-size: 0.85rem;
		color: #666;
	}
	.front {
		font-size: 2rem;
		margin: 1rem 0;
		overflow-wrap: anywhere;
	}
	hr {
		border: none;
		border-top: 1px solid #eee;
	}
	.reading {
		font-size: 1.25rem;
		margin: 0.5rem 0;
	}
	.meaning {
		font-size: 1.1rem;
	}
	.note {
		color: #555;
	}
	.ratings {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.ratings button,
	.show {
		padding: 0.6rem;
		font: inherit;
	}
	.show {
		width: 100%;
		margin-top: 1rem;
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
