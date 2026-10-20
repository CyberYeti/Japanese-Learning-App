<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import DefinitionPopover from '../../components/DefinitionPopover.svelte';
	import Furigana from '../../components/Furigana.svelte';
	import { createDictionary } from '../../lib/dict/lookup';
	import { tokenize } from '../../lib/nlp/tokenizer-client';
	import { groupWords, type Word } from '../../lib/nlp/words';

	const dictionary = createDictionary(`${resolve('/')}data/dict`);

	let text = $state('今日は友達と映画を見ました。とても面白かったです。晩ご飯は家で食べます。');
	let words = $state<Word[]>([]);
	let status = $state<{ kind: 'loading' | 'error'; text: string } | null>(null);
	let selected = $state<{ word: Word; x: number; y: number } | null>(null);
	let reader = $state<HTMLElement>();

	async function read(event?: SubmitEvent) {
		event?.preventDefault();
		selected = null;
		status = { kind: 'loading', text: 'Tokenizing… (the first run downloads the dictionary)' };
		try {
			words = groupWords(await tokenize(text));
			status = null;
		} catch (err) {
			status = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
		}
	}

	function select(word: Word, event: MouseEvent) {
		const target = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const box = reader!.getBoundingClientRect();
		selected = { word, x: Math.max(0, Math.min(target.left - box.left, box.width - 320)), y: target.bottom - box.top + 4 };
	}

	const tappable = (w: Word) => w.head.pos !== '記号' && w.surface.trim() !== '';

	// Keep punctuation on the same line as the word before it (no line starting with 。).
	const lineUnits = $derived(
		words.reduce<Word[][]>((units, w) => {
			const last = units.at(-1);
			if (last && !tappable(w) && w.surface.trim()) last.push(w);
			else units.push([w]);
			return units;
		}, [])
	);

	onMount(() => {
		read();
	});
</script>

<svelte:head><title>Reader · Japanese Learning App</title></svelte:head>

<!-- Close on Escape, or on a tap outside the popover that isn't on another word. -->
<svelte:window
	onkeydown={(e) => e.key === 'Escape' && (selected = null)}
	onclick={(e) => {
		const target = e.target as Element;
		if (!target.closest('.popover, button.word')) selected = null;
	}}
/>

<main>
	<p><a href={resolve('/')}>← Home</a></p>
	<h1>Reader</h1>

	<form onsubmit={read}>
		<textarea bind:value={text} rows="4" lang="ja" aria-label="Japanese text"></textarea>
		<button type="submit">Read</button>
	</form>

	{#if status}
		<p class={status.kind}>{status.text}</p>
	{/if}

	<div class="reader" lang="ja" bind:this={reader}>
		<p class="text">
			{#each lineUnits as unit, i (i)}{#if !unit[0].surface.trim()}{unit[0].surface}{:else}<span
						class="unit"
						>{#each unit as word, j (j)}{#if tappable(word)}<button
									class="word"
									class:active={selected?.word === word}
									onclick={(e) => select(word, e)}
									>{#each [word.head, ...word.endings] as token, k (k)}<Furigana
											surface={token.surface}
											reading={token.reading}
										/>{/each}</button
								>{:else}{word.surface}{/if}{/each}</span
					>{/if}{/each}
		</p>
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

	<p class="credits">Dictionary: JMdict (EDRDG, CC BY-SA). Tokenizer: kuromoji.js with IPADIC.</p>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: start;
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
		font-size: 1rem;
	}
	.reader {
		position: relative;
		margin-top: 1.5rem;
	}
	.text {
		font-size: 1.5rem;
		line-height: 2.6;
		white-space: pre-wrap;
	}
	.unit {
		white-space: nowrap;
	}
	.word {
		font: inherit;
		padding: 0 1px;
		margin: 0;
		border: none;
		border-radius: 0.25rem;
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.word:hover,
	.word.active {
		background: #e8f0fe;
	}
	:global(rt) {
		font-size: 0.5em;
		color: #555;
	}
	.loading,
	.credits {
		color: #666;
	}
	.credits {
		margin-top: 3rem;
		font-size: 0.8rem;
	}
	.error {
		color: #b00020;
	}
</style>
