<script lang="ts">
	import { alignFurigana, isKanji } from '../lib/nlp/furigana';

	interface Props {
		surface: string;
		reading: string | null;
		/** Kanji the learner knows get no furigana. Defaults to none known. */
		isKanjiKnown?: (kanji: string) => boolean;
	}

	let { surface, reading, isKanjiKnown = () => false }: Props = $props();

	const segments = $derived(reading ? alignFurigana(surface, reading) : [{ text: surface }]);
	const needsRuby = (text: string) => [...text].some((c) => isKanji(c) && !isKanjiKnown(c));
</script>

{#each segments as seg, i (i)}{#if seg.ruby && needsRuby(seg.text)}<ruby
			>{seg.text}<rt>{seg.ruby}</rt></ruby
		>{:else}{seg.text}{/if}{/each}
