<script lang="ts" module>
	/** Where to put the popover for a tapped word: just below it, kept inside `container`. */
	export function anchorBelow(event: MouseEvent, container: HTMLElement): { x: number; y: number } {
		const target = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const box = container.getBoundingClientRect();
		return { x: Math.max(0, Math.min(target.left - box.left, box.width - 320)), y: target.bottom - box.top + 4 };
	}
</script>

<script lang="ts">
	import type { DictEntry, Dictionary } from '../lib/dict/lookup';
	import { toHiragana } from '../lib/nlp/kana';
	import type { Token } from '../lib/nlp/tokenize';
	import { describeConjugation, type Word } from '../lib/nlp/words';

	interface Props {
		word: Word;
		dictionary: Dictionary;
		/** Position relative to the reader, in px. */
		x: number;
		y: number;
		onclose: () => void;
	}

	let { word, dictionary, x, y, onclose }: Props = $props();

	// The dictionary word is the head (見 of 見ました); the endings are explained separately.
	const token = $derived(word.head);
	const conjugation = $derived(describeConjugation(word));

	async function define(t: Token): Promise<DictEntry[]> {
		let entries = await dictionary.lookup(t.basicForm);
		if (!entries.length && t.surface !== t.basicForm) entries = await dictionary.lookup(t.surface);
		// Homographs (家: いえ / うち / け): list the one matching kuromoji's reading first.
		const matchesReading = (e: DictEntry) =>
			t.reading && e.kana.some((k) => toHiragana(k) === t.reading) ? 0 : 1;
		return entries.toSorted((a, b) => matchesReading(a) - matchesReading(b)).slice(0, 3);
	}

	const entries = $derived(define(token));
</script>

<div class="popover" role="dialog" aria-label="Definition of {token.basicForm}" style="left: {x}px; top: {y}px">
	<button class="close" onclick={onclose} aria-label="Close">×</button>
	{#snippet headword(reading: string | null | undefined)}
		<p class="headword">
			<span lang="ja">{token.basicForm}</span>
			{#if reading}<span class="reading" lang="ja">{reading}</span>{/if}
		</p>
		<p class="pos" lang="ja">{token.pos}{token.posDetail ? ` · ${token.posDetail}` : ''}</p>
		{#if conjugation}
			<div class="conjugation">
				<p>
					<span lang="ja">{word.surface}</span>{#if conjugation.summary}: {conjugation.summary}{/if}
				</p>
				<ul>
					{#each conjugation.parts as part, i (i)}
						<li>
							<span lang="ja">{part.surface}{part.base !== part.surface ? ` (${part.base})` : ''}</span>
							{#if part.meaning}<span class="muted">: {part.meaning}</span>{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/snippet}
	<!-- kuromoji's reading is for the surface (食べ → たべ); for conjugated words, use the
	     dictionary entry's reading instead. -->
	{#await entries}
		{@render headword(token.surface === token.basicForm ? token.reading : null)}
		<p class="muted">Looking up…</p>
	{:then found}
		{@render headword(token.surface === token.basicForm ? token.reading : found[0]?.kana[0])}
		{#if found.length}
			{#each found as entry (entry.id)}
				<div class="entry">
					{#if entry.kanji.length || entry.kana.length}
						<p class="forms" lang="ja">{[...entry.kanji, ...entry.kana].slice(0, 4).join('、')}</p>
					{/if}
					<ol>
						{#each entry.senses.slice(0, 3) as sense, i (i)}
							<li>{sense.gloss.join('; ')}</li>
						{/each}
					</ol>
				</div>
			{/each}
		{:else}
			<p class="muted">No dictionary entry.</p>
		{/if}
	{:catch err}
		{@render headword(null)}
		<p class="error">Lookup failed: {err.message}</p>
	{/await}
</div>

<style>
	.popover {
		position: absolute;
		z-index: 10;
		width: min(20rem, calc(100vw - 2rem));
		max-height: 60vh;
		overflow-y: auto;
		padding: 0.75rem 1rem;
		background: #fff;
		border: 1px solid #ccc;
		border-radius: 0.5rem;
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
	}
	.close {
		float: right;
		border: none;
		background: none;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
	}
	.headword {
		margin: 0;
		font-size: 1.4rem;
	}
	.reading {
		margin-left: 0.5rem;
		font-size: 1rem;
		color: #555;
	}
	.pos {
		margin: 0.25rem 0 0.5rem;
		font-size: 0.85rem;
		color: #666;
	}
	.conjugation {
		margin-bottom: 0.5rem;
		padding: 0.4rem 0.6rem;
		background: #f5f5f5;
		border-radius: 0.25rem;
		font-size: 0.9rem;
	}
	.conjugation p {
		margin: 0;
	}
	.conjugation ul {
		margin: 0.25rem 0 0;
		padding-left: 1.1rem;
	}
	.entry + .entry {
		border-top: 1px solid #eee;
		margin-top: 0.5rem;
	}
	.forms {
		margin: 0.5rem 0 0;
		color: #444;
	}
	ol {
		margin: 0.25rem 0;
		padding-left: 1.25rem;
	}
	.muted {
		color: #666;
	}
	.error {
		color: #b00020;
	}
</style>
