<script lang="ts">
	import type { Word } from '../lib/nlp/words';
	import Furigana from './Furigana.svelte';

	interface Props {
		words: Word[];
		/** The word whose definition is open, highlighted. */
		active?: Word | null;
		onselect: (word: Word, event: MouseEvent) => void;
		isKanjiKnown?: (kanji: string) => boolean;
	}

	let { words, active = null, onselect, isKanjiKnown }: Props = $props();

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
</script>

<!-- Clicks on button.word are how pages tell a tap on another word from a tap outside. -->
{#each lineUnits as unit, i (i)}{#if !unit[0].surface.trim()}{unit[0].surface}{:else}<span class="unit"
			>{#each unit as word, j (j)}{#if tappable(word)}<button
						class="word"
						class:active={active === word}
						onclick={(e) => onselect(word, e)}
						>{#each [word.head, ...word.endings] as token, k (k)}<Furigana
								surface={token.surface}
								reading={token.reading}
								{isKanjiKnown}
							/>{/each}</button
					>{:else}{word.surface}{/if}{/each}</span
		>{/if}{/each}

<style>
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
</style>
