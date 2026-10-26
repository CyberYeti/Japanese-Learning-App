<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Session } from '@supabase/supabase-js';
	import ReadyIndicator from '../components/ReadyIndicator.svelte';
	import { loadApiKey } from '../lib/ai/api-key';
	import { supabase, supabaseConfigured } from '../lib/db/supabase';
	import { magicLinkRedirectUrl, signInWithMagicLink } from '../lib/db/auth';
	import { loadNextReadyPassageId } from '../lib/db/passages';
	import { loadHomeSummary, type HomeSummary } from '../lib/db/reviews';
	import { loadCurrentLesson } from '../lib/lessons/readiness';
	import { createPassage } from '../lib/passage/create';
	import { MAX_ATTEMPTS } from '../lib/passage/generate-passage';
	import { onPassagePregenerated, replenishInBackground } from '../lib/passage/pregenerate';

	let session = $state<Session | null>(null);
	let loading = $state(true);
	let email = $state('');
	let status = $state<{ kind: 'sent' | 'error'; text: string } | null>(null);
	let sending = $state(false);

	onMount(() => {
		supabase.auth.getSession().then(({ data }) => {
			session = data.session;
			loading = false;
		});
		const { data } = supabase.auth.onAuthStateChange((_event, next) => {
			session = next;
		});
		return () => data.subscription.unsubscribe();
	});

	async function login(event: SubmitEvent) {
		event.preventDefault();
		sending = true;
		status = null;
		const result = await signInWithMagicLink(
			supabase,
			email,
			magicLinkRedirectUrl(window.location.origin, resolve('/'))
		);
		status = result.ok
			? { kind: 'sent', text: 'Check your email for the login link.' }
			: { kind: 'error', text: result.message };
		sending = false;
	}

	async function logout() {
		await supabase.auth.signOut();
	}

	let summary = $state<HomeSummary | null>(null);
	let summaryError = $state<string | null>(null);
	let current = $state<Awaited<ReturnType<typeof loadCurrentLesson>>>(null);

	// Reload whenever the signed-in user changes.
	$effect(() => {
		if (!session) return;
		let stale = false;
		summary = null;
		summaryError = null;
		loadHomeSummary(new Date())
			.then((s) => !stale && (summary = s))
			.catch((err) => !stale && (summaryError = err instanceof Error ? err.message : String(err)));
		current = null;
		// The ready indicator is advisory, so if it can't load the home page just goes without it.
		loadCurrentLesson()
			.then((c) => !stale && (current = c))
			.catch((err) => console.warn('Loading the current lesson failed', err));
		// Top up the ready passages (SPEC §5.3); when one lands while none was ready, offer it.
		replenishInBackground(loadApiKey());
		const unsubscribe = onPassagePregenerated(async () => {
			if (!summary || summary.readyPassageId) return;
			const id = await loadNextReadyPassageId(new Date()).catch(() => null);
			if (!stale && summary) summary.readyPassageId = id;
		});
		return () => {
			stale = true;
			unsubscribe();
		};
	});

	async function readToday() {
		if (summary?.readyPassageId) await goto(resolve('/read/[passageId]', { passageId: summary.readyPassageId }));
		else await generate();
	}

	let generating = $state<string | null>(null);
	let generateError = $state<string | null>(null);

	async function generate() {
		const apiKey = loadApiKey();
		if (!apiKey) {
			generateError = 'Add your Gemini API key in Settings first.';
			return;
		}
		generateError = null;
		generating = 'Preparing…';
		try {
			const id = await createPassage({
				apiKey,
				// Only runs when no pre-generated passage is ready, so the reader is waiting.
				priority: 'speed',
				onAttempt: (n) =>
					(generating = n === 1 ? 'Writing a passage…' : `Revising the passage (attempt ${n} of ${MAX_ATTEMPTS})…`)
			});
			replenishInBackground(apiKey);
			await goto(resolve('/read/[passageId]', { passageId: id }));
		} catch (err) {
			generateError = err instanceof Error ? err.message : String(err);
		} finally {
			generating = null;
		}
	}
</script>

<svelte:head><title>Japanese Learning App</title></svelte:head>

<main>
	<h1>Japanese Learning App</h1>
	<p>
		<a href={resolve('/lessons')}>Lessons</a> · <a href={resolve('/cards')}>Flashcards</a> ·
		<a href={resolve('/reader')}>Open the reader</a> ·
		<a href={resolve('/settings')}>Settings</a> · <a href={resolve('/about')}>About</a>
	</p>

	{#if !supabaseConfigured}
		<p class="error">
			Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
		</p>
	{:else if loading}
		<p>Loading…</p>
	{:else if session}
		<p>Signed in as <strong>{session.user.email}</strong></p>
		{#if summary}
			<p class="due">
				<strong>{summary.due}</strong>
				{summary.due === 1 ? 'item' : 'items'} due · {summary.learning} learning · {summary.known} known
			</p>
			{#if summary.due}
				<p><a href={resolve('/cards')}>Review due items as flashcards</a></p>
			{/if}
		{:else if summaryError}
			<p class="error">{summaryError}</p>
		{/if}
		<p>
			<button onclick={readToday} disabled={generating !== null}>Read today's passage</button>
			{#if generating}<span class="muted">{generating}</span>{/if}
		</p>
		{#if generateError}
			<p class="error">{generateError}</p>
		{/if}
		{#if current}
			<p>
				Current lesson:
				<a href={resolve('/lessons/[id]', { id: current.lesson.id })}>{current.lesson.title}</a><br />
				<ReadyIndicator readiness={current.readiness} />
			</p>
		{/if}
		<button onclick={logout}>Log out</button>
	{:else}
		<form onsubmit={login}>
			<label>
				Email
				<input type="email" bind:value={email} autocomplete="email" required />
			</label>
			<button type="submit" disabled={sending}>Send magic link</button>
		</form>
		{#if status}
			<p class={status.kind === 'error' ? 'error' : ''}>{status.text}</p>
		{/if}
	{/if}
</main>

<style>
	main {
		max-width: 28rem;
		margin: 3rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	form {
		display: flex;
		gap: 0.5rem;
		align-items: end;
	}
	label {
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: 0.25rem;
	}
	.due strong {
		font-size: 1.5rem;
	}
	.muted {
		color: #666;
	}
	.error {
		color: #b00020;
	}
</style>
