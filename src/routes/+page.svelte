<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { Session } from '@supabase/supabase-js';
	import { supabase, supabaseConfigured } from '../lib/db/supabase';
	import { magicLinkRedirectUrl, signInWithMagicLink } from '../lib/db/auth';

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
</script>

<svelte:head><title>Japanese Learning App</title></svelte:head>

<main>
	<h1>Japanese Learning App</h1>
	<p><a href={resolve('/reader')}>Open the reader</a></p>

	{#if !supabaseConfigured}
		<p class="error">
			Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
		</p>
	{:else if loading}
		<p>Loading…</p>
	{:else if session}
		<p>Signed in as <strong>{session.user.email}</strong></p>
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
	.error {
		color: #b00020;
	}
</style>
