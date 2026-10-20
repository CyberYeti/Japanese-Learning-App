<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import DefinitionPopover from '../../components/DefinitionPopover.svelte';
	import Furigana from '../../components/Furigana.svelte';
	import { createDictionary } from '../../lib/dict/lookup';
	import { tokenize } from '../../lib/nlp/tokenizer-client';
	import type { Token } from '../../lib/nlp/tokenize';

	const dictionary = createDictionary(`${resolve('/')}data/dict`);

	let text = $state('今日は友達と映画を見ました。とても面白かったです。晩ご飯は家で食べます。');
	let tokens = $state<Token[]>([]);
	let status = $state<{ kind: 'loading' | 'error'; text: string } | null>(null);
	let selected = $state<{ token: Token; x: number; y: number } | null>(null);
	let reader = $state<HTMLElement>();

	async function read(event?: SubmitEvent) {
		event?.preventDefault();
		selected = null;
		status = { kind: 'loading', text: 'Tokenizing… (the first run downloads the dictionary)' };
		try {
			tokens = await tokenize(text);
			status = null;
		} catch (err) {
			status = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
		}
	}

	function select(token: Token, event: MouseEvent) {
		const target = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const box = reader!.getBoundingClientRect();
		selected = { token, x: Math.max(0, Math.min(target.left - box.left, box.width - 320)), y: target.bottom - box.top + 4 };
	}

	const tappable = (t: Token) => t.pos !== '記号' && t.surface.trim() !== '';

	// Keep punctuation on the same line as the word before it (no line starting with 。).
	const words = $derived(
		tokens.reduce<Token[][]>((groups, t) => {
			const last = groups.at(-1);
			if (last && !tappable(t) && t.surface.trim()) last.push(t);
			else groups.push([t]);
			return groups;
		}, [])
	);

	onMount(() => {
		read();
	});
</script>

<svelte:head><title>Reader · Japanese Learning App</title></svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (selected = null)} />

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
			{#each words as group, i (i)}{#if !group[0].surface.trim()}{group[0].surface}{:else}<span
						class="word"
						>{#each group as token, j (j)}{#if tappable(token)}<button
									class="token"
									class:active={selected?.token === token}
									onclick={(e) => select(token, e)}
									><Furigana surface={token.surface} reading={token.reading} /></button
								>{:else}{token.surface}{/if}{/each}</span
					>{/if}{/each}
		</p>
		{#if selected}
			<DefinitionPopover
				token={selected.token}
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
	.word {
		white-space: nowrap;
	}
	.token {
		font: inherit;
		padding: 0 1px;
		margin: 0;
		border: none;
		border-radius: 0.25rem;
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.token:hover,
	.token.active {
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
