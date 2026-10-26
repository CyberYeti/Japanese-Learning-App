// Browser glue for the pre-generation buffer: fills it from Supabase + Gemini in the background.
// Runs at module level, not in a page, so navigating between pages doesn't cancel it.
import { deleteReadyPassages, loadReadyPassages } from '../db/passages';
import { fillBuffer, singleFlight } from './buffer';
import { createPassage } from './create';

const listeners = new Set<() => void>();

/** Call `listener` whenever a pre-generated passage is saved; returns an unsubscribe function. */
export function onPassagePregenerated(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/**
 * Discard expired ready passages and generate replacements until two are ready. Background work, so
 * it uses the 'quality' model. Calls made while a run is in progress join it. Resolves to the number
 * of passages generated.
 */
export const replenishPassages = singleFlight((apiKey: string) =>
	fillBuffer({
		listReady: loadReadyPassages,
		deleteReady: deleteReadyPassages,
		create: () => createPassage({ apiKey, priority: 'quality' }),
		onCreated: () => listeners.forEach((listener) => listener())
	})
);

/** Start replenishing without waiting; failures only reach the console, since nobody is waiting on it. */
export function replenishInBackground(apiKey: string): void {
	if (!apiKey) return;
	replenishPassages(apiKey).catch((err) => console.warn('Pre-generating passages failed:', err));
}
