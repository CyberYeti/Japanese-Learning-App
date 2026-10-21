<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Session } from '@supabase/supabase-js';
	import { loadApiKey } from '../lib/ai/api-key';
	import { supabase, supabaseConfigured } from '../lib/db/supabase';
	import { magicLinkRedirectUrl, signInWithMagicLink } from '../lib/db/auth';
	import { createPassage } from '../lib/passage/create';
	import { MAX_ATTEMPTS } from '../lib/passage/generate-passage';

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
				// The reader is waiting; once passages are pre-generated (#6) this only runs when none is ready.
				priority: 'speed',
				onAttempt: (n) =>
					(generating = n === 1 ? 'Writing a passage…' : `Revising the passage (attempt ${n} of ${MAX_ATTEMPTS})…`)
			});
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
	<p><a href={resolve('/reader')}>Open the reader</a> · <a href={resolve('/settings')}>Settings</a></p>

	{#if !supabaseConfigured}
		<p class="error">
			Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
		</p>
	{:else if loading}
		<p>Loading…</p>
	{:else if session}
		<p>Signed in as <strong>{session.user.email}</strong></p>
		<p>
			<button onclick={generate} disabled={generating !== null}>Generate a passage</button>
			{#if generating}<span class="muted">{generating}</span>{/if}
		</p>
		{#if generateError}
			<p class="error">{generateError}</p>
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
	.muted {
		color: #666;
	}
	.error {
		color: #b00020;
	}
</style>
