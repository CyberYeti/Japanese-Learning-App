<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import DefinitionPopover, { anchorBelow } from '../../../components/DefinitionPopover.svelte';
	import WordText from '../../../components/WordText.svelte';
	import { loadKnownKanji, loadPassage, type StoredPassage } from '../../../lib/db/passages';
	import { createDictionary } from '../../../lib/dict/lookup';
	import { groupWords, type Word } from '../../../lib/nlp/words';

	const dictionary = createDictionary(`${resolve('/')}data/dict`);

	// Raw, not deep, state: these are only ever replaced, and a proxied `selected.word` would never
	// be === the word WordText renders, so the tapped word wouldn't highlight.
	let passage = $state.raw<StoredPassage | null>(null);
	let knownKanji = $state.raw(new Set<string>());
	let status = $state<{ kind: 'loading' | 'error'; text: string } | null>({ kind: 'loading', text: 'Loading passage…' });
	let selected = $state.raw<{ word: Word; x: number; y: number } | null>(null);
	let revealed = $state<boolean[]>([]);
	let reader = $state<HTMLElement>();

	$effect(() => {
		const id = page.params.passageId!;
		passage = null;
		status = { kind: 'loading', text: 'Loading passage…' };
		let stale = false;
		Promise.all([loadPassage(id), loadKnownKanji()])
			.then(([found, kanji]) => {
				if (stale) return;
				passage = found;
				knownKanji = kanji;
				revealed = found ? found.content.sentences.map(() => false) : [];
				status = found ? null : { kind: 'error', text: 'Passage not found. Are you signed in?' };
			})
			.catch((err) => {
				if (!stale) status = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
			});
		return () => (stale = true);
	});

	const sentences = $derived(
		passage?.content.sentences.map((s) => ({ ...s, words: groupWords(s.tokens) })) ?? []
	);
	const allRevealed = $derived(revealed.length > 0 && revealed.every(Boolean));
	const isKanjiKnown = (kanji: string) => knownKanji.has(kanji);

	function select(word: Word, event: MouseEvent) {
		selected = { word, ...anchorBelow(event, reader!) };
	}
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

		<div class="reader" bind:this={reader}>
			{#each sentences as sentence, i (i)}
				<div class="sentence">
					<p class="jp" lang="ja">
						<WordText words={sentence.words} active={selected?.word} onselect={select} {isKanjiKnown} />
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
				/>
			{/if}
		</div>

		<p class="meta">Coverage {Math.round(passage.coverage * 100)}% · topic: {passage.topic}</p>
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
