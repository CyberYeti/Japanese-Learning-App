<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { loadApiKey, saveApiKey } from '../../lib/ai/api-key';

	let apiKey = $state('');
	let show = $state(false);
	let status = $state<{ kind: 'saved' | 'error'; text: string } | null>(null);

	onMount(() => {
		apiKey = loadApiKey();
	});

	function save(event: SubmitEvent) {
		event.preventDefault();
		try {
			saveApiKey(apiKey);
			apiKey = apiKey.trim();
			status = { kind: 'saved', text: apiKey ? 'Saved in this browser.' : 'Key removed from this browser.' };
		} catch (err) {
			status = { kind: 'error', text: `Couldn't save: ${err instanceof Error ? err.message : String(err)}` };
		}
	}
</script>

<svelte:head><title>Settings · Japanese Learning App</title></svelte:head>

<main>
	<p><a href={resolve('/')}>← Home</a></p>
	<h1>Settings</h1>

	<section>
		<h2>Gemini API key</h2>
		<p class="muted">
			Passages are written by Google Gemini. Get a free key at
			<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>. The key
			stays in this browser only, so each device needs its own entry. On the free tier Google may use prompts to
			improve its models, so they contain only study material.
		</p>
		<form onsubmit={save}>
			<label>
				API key
				<input
					type={show ? 'text' : 'password'}
					bind:value={apiKey}
					autocomplete="off"
					spellcheck="false"
					placeholder="AIza…"
				/>
			</label>
			<label class="inline"><input type="checkbox" bind:checked={show} /> Show</label>
			<button type="submit">Save</button>
		</form>
		{#if status}
			<p class={status.kind}>{status.text}</p>
		{/if}
	</section>
</main>

<style>
	main {
		max-width: 36rem;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: end;
	}
	label {
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: 0.25rem;
	}
	label.inline {
		flex: none;
		flex-direction: row;
		align-items: center;
	}
	input:not([type='checkbox']) {
		font: inherit;
		min-width: 0;
	}
	.muted {
		color: #555;
	}
	.saved {
		color: #1b5e20;
	}
	.error {
		color: #b00020;
	}
</style>
