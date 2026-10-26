<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import DefinitionPopover, { anchorBelow } from '../../../components/DefinitionPopover.svelte';
	import QuestionCard from '../../../components/QuestionCard.svelte';
	import WordText from '../../../components/WordText.svelte';
	import { loadApiKey } from '../../../lib/ai/api-key';
	import { loadKanjiKnowledge, loadPassage, saveKanji, type StoredPassage } from '../../../lib/db/passages';
	import { loadSettings } from '../../../lib/db/settings';
	import { createDictionary } from '../../../lib/dict/lookup';
	import { groupWords, type Word } from '../../../lib/nlp/words';
	import { finishPassage, type FinishResult, type TokenPosition } from '../../../lib/passage/finish';
	import { replenishInBackground } from '../../../lib/passage/pregenerate';
	import { isKanjiKnown as knows, toggleKanji, type KanjiKnowledge } from '../../../lib/srs/kanji';
	import { Rating } from '../../../lib/srs/scheduler';

	const dictionary = createDictionary(`${resolve('/')}data/dict`);

	// Raw, not deep, state: these are only ever replaced, and a proxied `selected.word` would never
	// be === the word WordText renders, so the tapped word wouldn't highlight.
	let passage = $state.raw<StoredPassage | null>(null);
	let kanji = $state.raw<KanjiKnowledge>({ auto: new Set(), overrides: new Map() });
	let kanjiError = $state<string | null>(null);
	let status = $state<{ kind: 'loading' | 'error'; text: string } | null>({ kind: 'loading', text: 'Loading passage…' });
	let selected = $state.raw<{ word: Word; x: number; y: number } | null>(null);
	let revealed = $state<boolean[]>([]);
	let reader = $state<HTMLElement>();
	// Taps and answers grade the passage on Done (SPEC §5.5).
	let tapped: TokenPosition[] = [];
	let chosen = $state<(number | null)[]>([]);
	let finishing = $state(false);
	let finished = $state.raw<FinishResult | null>(null);
	let finishError = $state<string | null>(null);

	$effect(() => {
		const id = page.params.passageId!;
		passage = null;
		status = { kind: 'loading', text: 'Loading passage…' };
		let stale = false;
		Promise.all([loadPassage(id), loadSettings().then((s) => loadKanjiKnowledge(s.known_kanji_threshold))])
			.then(([found, knowledge]) => {
				if (stale) return;
				passage = found;
				kanji = knowledge;
				revealed = found ? found.content.sentences.map(() => false) : [];
				chosen = found ? found.content.questions.map(() => null) : [];
				tapped = [];
				finished = null;
				finishError = null;
				status = found ? null : { kind: 'error', text: 'Passage not found. Are you signed in?' };
			})
			.catch((err) => {
				if (!stale) status = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
			});
		return () => (stale = true);
	});

	const newSpellings = $derived(new Set(passage?.content.new_words?.flatMap((w) => w.spellings) ?? []));
	const sentences = $derived(
		passage?.content.sentences.map((s) => {
			// A word is new if its head token's vocab key is one of the new words' spellings.
			const newHeads = new Set(s.tokens.filter((_, i) => newSpellings.has(s.keys?.[i] ?? '')));
			return { ...s, words: groupWords(s.tokens), isNew: (w: Word) => newHeads.has(w.head) };
		}) ?? []
	);
	const allRevealed = $derived(revealed.length > 0 && revealed.every(Boolean));
	const isKanjiKnown = (k: string) => knows(kanji, k);

	// Tapping a kanji in the popover flips it known/not known (SPEC §5.1); furigana updates at once.
	async function toggle(k: string) {
		const before = kanji;
		const { knowledge, row } = toggleKanji(kanji, k);
		kanji = knowledge;
		kanjiError = null;
		try {
			await saveKanji(row);
		} catch (err) {
			kanji = before;
			kanjiError = err instanceof Error ? err.message : String(err);
		}
	}

	function select(word: Word, event: MouseEvent, sentence: number) {
		selected = { word, ...anchorBelow(event, reader!) };
		tapped.push({ sentence, token: passage!.content.sentences[sentence].tokens.indexOf(word.head) });
	}

	async function finish() {
		if (!passage) return;
		finishing = true;
		finishError = null;
		try {
			const answers = passage.content.questions.flatMap((q, i) =>
				chosen[i] === null ? [] : [{ grammar_id: q.grammar_id, correct: chosen[i] === q.answer }]
			);
			finished = await finishPassage(passage, tapped, answers);
			// This passage no longer counts as ready; generate its replacement while the reader moves on.
			if (finished.saved) replenishInBackground(loadApiKey());
		} catch (err) {
			finishError = err instanceof Error ? err.message : String(err);
		} finally {
			finishing = false;
		}
	}

	const countRated = (rating: Rating) => finished?.grades.filter((g) => g.rating === rating).length ?? 0;
</script>

<svelte:head><title>{passage?.content.title || 'Passage'} · Japanese Learning App</title></svelte:head>

<svelte:window
	onkeydown={(e) => e.key === 'Escape' && (selected = null)}
	onclick={(e) => {
		const target = e.target as Element;
		if (!target.closest('.popover, button.word')) selected = null;
	}}
/>

<main>
	<p><a href={resolve('/')}>← Home</a></p>

	{#if status}
		<p class={status.kind}>{status.text}</p>
	{/if}

	{#if passage}
		<header>
			<h1 lang="ja">{passage.content.title}</h1>
			<button class="toggle" onclick={() => (revealed = revealed.map(() => !allRevealed))}>
				{allRevealed ? 'Hide' : 'Show'} all translations
			</button>
		</header>

		{#if passage.content.new_words?.length}
			<p class="new-words">
				New:
				{#each passage.content.new_words as w, i (w.key)}{i ? '、' : ''}<span lang="ja">{w.kanji ?? w.kana}</span
					>{#if w.kanji}<span class="meta" lang="ja"> ({w.kana})</span>{/if} {w.gloss}{/each}
			</p>
		{/if}

		<div class="reader" bind:this={reader}>
			{#each sentences as sentence, i (i)}
				<div class="sentence">
					<p class="jp" lang="ja">
						<WordText
							words={sentence.words}
							active={selected?.word}
							onselect={(word, e) => select(word, e, i)}
							{isKanjiKnown}
							isNew={sentence.isNew}
						/>
					</p>
					{#if revealed[i]}
						<button class="en" onclick={() => (revealed[i] = false)}>{sentence.en}</button>
					{:else}
						<button class="reveal" onclick={() => (revealed[i] = true)}>Show translation</button>
					{/if}
				</div>
			{/each}
			{#if selected}
				<DefinitionPopover
					word={selected.word}
					{dictionary}
					x={selected.x}
					y={selected.y}
					onclose={() => (selected = null)}
					{isKanjiKnown}
					ontogglekanji={toggle}
				/>
			{/if}
		</div>
		{#if kanjiError}<p class="error">{kanjiError}</p>{/if}

		{#if passage.content.questions.length}
			<section class="questions">
				<h2>Questions</h2>
				<p class="meta">Optional. Each answer reviews the grammar it asks about.</p>
				{#each passage.content.questions as question, i (i)}
					<QuestionCard
						{question}
						chosen={chosen[i]}
						disabled={passage.status === 'read' || finished !== null}
						onanswer={(choice) => (chosen[i] = choice)}
					/>
				{/each}
			</section>
		{/if}

		<section class="done">
			{#if finished}
				{#if finished.saved}
					<p>
						Reviewed {finished.grades.length}
						{finished.grades.length === 1 ? 'item' : 'items'}: {countRated(Rating.Good)} remembered, {countRated(Rating.Again)} to
						review again.
					</p>
				{:else}
					<p>This passage was already marked read, so nothing more was recorded.</p>
				{/if}
				<p><a href={resolve('/')}>Back home</a></p>
			{:else if passage.status === 'read'}
				<p class="meta">You've already read this passage.</p>
			{:else}
				<button onclick={finish} disabled={finishing}>{finishing ? 'Saving…' : 'Done'}</button>
				{#if finishError}<p class="error">{finishError}</p>{/if}
			{/if}
		</section>

		<p class="meta">
			Coverage {Math.round(passage.coverage * 100)}% · topic: {passage.topic}{passage.format ? ` · ${passage.format}` : ''}
		</p>
	{/if}

	<p class="credits">Dictionary: JMdict (EDRDG, CC BY-SA). Tokenizer: kuromoji.js with IPADIC.</p>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: baseline;
		justify-content: space-between;
	}
	.reader {
		position: relative;
	}
	.sentence {
		margin-bottom: 1rem;
	}
	.new-words {
		margin: 0.5rem 0 1rem;
		padding: 0.25rem 0.5rem;
		background: #fff4c2;
		border-radius: 0.25rem;
		font-size: 0.9rem;
	}
	.questions h2 {
		font-size: 1.1rem;
		margin: 2rem 0 0;
	}
	.done {
		margin: 1.5rem 0;
	}
	.done button {
		font: inherit;
		padding: 0.5rem 1.5rem;
	}
	.jp {
		margin: 0;
		font-size: 1.5rem;
		line-height: 2.6;
	}
	.reveal,
	.en,
	.toggle {
		font: inherit;
		border: none;
		background: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
	}
	.reveal,
	.toggle {
		color: #1a56c4;
		font-size: 0.9rem;
	}
	.en {
		color: #333;
	}
	:global(rt) {
		font-size: 0.5em;
		color: #555;
	}
	.loading,
	.meta,
	.credits {
		color: #666;
	}
	.meta {
		font-size: 0.85rem;
	}
	.credits {
		margin-top: 3rem;
		font-size: 0.8rem;
	}
	.error {
		color: #b00020;
	}
</style>
