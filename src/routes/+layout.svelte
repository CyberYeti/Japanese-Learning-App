<script lang="ts">
	import { onMount } from 'svelte';
	import { initTokenizer } from '../lib/nlp/tokenizer-client';

	let { children } = $props();

	// Start the tokenizer worker eagerly (ADR 0001) so the dictionary is ready before it's needed.
	onMount(() => {
		initTokenizer().catch((err) => console.error('Tokenizer failed to load', err));
	});
</script>

{@render children()}
