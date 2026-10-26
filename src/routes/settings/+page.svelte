<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { loadApiKey, saveApiKey } from '../../lib/ai/api-key';
	import { loadSettings, saveSettings } from '../../lib/db/settings';
	import { supabase } from '../../lib/db/supabase';
	import { DEFAULT_SETTINGS, LIMITS, parseInterestTags, type Politeness, type Settings } from '../../lib/settings/settings';

	let apiKey = $state('');
	let show = $state(false);
	let status = $state<{ kind: 'saved' | 'error'; text: string } | null>(null);

	// Study settings live in Supabase, so they follow the account across devices.
	let signedIn = $state<boolean | null>(null);
	let interests = $state('');
	let politeness = $state<Politeness>(DEFAULT_SETTINGS.politeness);
	let dailyNewWords = $state(DEFAULT_SETTINGS.daily_new_words);
	let kanjiThreshold = $state(DEFAULT_SETTINGS.known_kanji_threshold);
	let coveragePercent = $state(DEFAULT_SETTINGS.coverage_threshold * 100);
	let studyStatus = $state<{ kind: 'loading' | 'saved' | 'error'; text: string } | null>(null);
	let savingStudy = $state(false);

	onMount(() => {
		apiKey = loadApiKey();
		supabase.auth.getSession().then(async ({ data }) => {
			signedIn = data.session !== null;
			if (!signedIn) return;
			studyStatus = { kind: 'loading', text: 'Loading…' };
			try {
				fill(await loadSettings());
				studyStatus = null;
			} catch (err) {
				studyStatus = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
			}
		});
	});

	function fill(settings: Settings) {
		interests = settings.interest_tags.join(', ');
		politeness = settings.politeness;
		dailyNewWords = settings.daily_new_words;
		kanjiThreshold = settings.known_kanji_threshold;
		coveragePercent = Math.round(settings.coverage_threshold * 100);
	}

	async function saveStudy(event: SubmitEvent) {
		event.preventDefault();
		savingStudy = true;
		studyStatus = null;
		try {
			fill(
				await saveSettings({
					interest_tags: parseInterestTags(interests),
					politeness,
					daily_new_words: dailyNewWords,
					known_kanji_threshold: kanjiThreshold,
					coverage_threshold: coveragePercent / 100
				})
			);
			studyStatus = { kind: 'saved', text: 'Saved. Passages written from now on use these settings.' };
		} catch (err) {
			studyStatus = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
		} finally {
			savingStudy = false;
		}
	}

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

	<section>
		<h2>Passages</h2>
		{#if signedIn === false}
			<p class="muted">Sign in on the home page to change these.</p>
		{:else if signedIn}
			<form class="study" onsubmit={saveStudy}>
				<label>
					Interests
					<input bind:value={interests} placeholder="trains, baseball, cats" />
					<span class="hint">
						Separated by commas. About half of passages are about one of these; the rest are everyday situations.
					</span>
				</label>
				<label>
					Politeness
					<select bind:value={politeness}>
						<option value="polite">Polite (です/ます)</option>
						<option value="plain">Plain (だ, dictionary forms)</option>
						<option value="mixed">Mixed, as fits the speaker</option>
					</select>
				</label>
				<label>
					New words per day
					<input
						type="number"
						bind:value={dailyNewWords}
						min={LIMITS.daily_new_words.min}
						max={LIMITS.daily_new_words.max}
						required
					/>
					<span class="hint">JLPT words introduced through passages, at most 3 per passage.</span>
				</label>
				<label>
					Known kanji threshold
					<input
						type="number"
						bind:value={kanjiThreshold}
						min={LIMITS.known_kanji_threshold.min}
						max={LIMITS.known_kanji_threshold.max}
						required
					/>
					<span class="hint">
						A kanji counts as known, and loses its furigana, once this many known words use it. Tap a word's kanji in
						a passage to set it by hand.
					</span>
				</label>
				<label>
					Coverage threshold (%)
					<input
						type="number"
						bind:value={coveragePercent}
						min={LIMITS.coverage_threshold.min * 100}
						max={LIMITS.coverage_threshold.max * 100}
						required
					/>
					<span class="hint">Share of a passage's words you must already have; below it the passage is rewritten.</span>
				</label>
				<button type="submit" disabled={savingStudy}>{savingStudy ? 'Saving…' : 'Save'}</button>
			</form>
			<p class="muted hint">The two passages already prepared keep the settings they were written with.</p>
		{/if}
		{#if studyStatus}
			<p class={studyStatus.kind}>{studyStatus.text}</p>
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
	input:not([type='checkbox']),
	select {
		font: inherit;
		min-width: 0;
	}
	form.study {
		flex-direction: column;
		align-items: stretch;
		gap: 1rem;
	}
	form.study button {
		align-self: start;
	}
	.hint {
		color: #666;
		font-size: 0.85rem;
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
