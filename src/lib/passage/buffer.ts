// The pre-generation buffer (SPEC §5.3): keep BUFFER_SIZE fresh ready passages so one opens instantly.
// Storage and generation are injected, so the loop runs in tests without Supabase or Gemini.

/** Ready passages to keep on hand. */
export const BUFFER_SIZE = 2;

/** Ready passages older than this are discarded: the due items they were built around have shifted. */
export const MAX_READY_AGE_MS = 24 * 60 * 60 * 1000;

/** The oldest creation time a ready passage can have and still be read. */
export const freshSince = (now: Date) => new Date(now.getTime() - MAX_READY_AGE_MS);

export interface ReadyPassage {
	id: string;
	created_at: string;
}

export interface BufferPlan {
	/** Ready passages too old to read, to delete. */
	expired: string[];
	/** How many passages to generate to fill the buffer. */
	missing: number;
}

export function planBuffer(ready: ReadyPassage[], now: Date, size = BUFFER_SIZE): BufferPlan {
	const cutoff = freshSince(now).getTime();
	const expired = ready.filter((p) => new Date(p.created_at).getTime() < cutoff).map((p) => p.id);
	return { expired, missing: Math.max(0, size - (ready.length - expired.length)) };
}

export interface BufferDeps {
	listReady(): Promise<ReadyPassage[]>;
	/** Delete these passages, but only while they are still unread. */
	deleteReady(ids: string[]): Promise<void>;
	/** Generate and save one passage; returns its id. */
	create(): Promise<string>;
	/** Called after each passage is saved. */
	onCreated?(id: string): void;
	now?(): Date;
}

/**
 * Delete expired ready passages, then generate one passage at a time until the buffer is full.
 * The ready list is re-read before each passage, so a passage generated elsewhere meanwhile (the
 * home page when none was ready, another device) counts towards the buffer. Stops at the first
 * failure, so an outage or spent quota doesn't burn through further calls.
 */
export async function fillBuffer(deps: BufferDeps, size = BUFFER_SIZE): Promise<number> {
	const now = deps.now ?? (() => new Date());
	let created = 0;
	// Bounded so a store that never reports the new rows can't loop forever.
	for (let i = 0; i < size; i++) {
		const plan = planBuffer(await deps.listReady(), now(), size);
		if (plan.expired.length) await deps.deleteReady(plan.expired);
		if (plan.missing === 0) break;
		const id = await deps.create();
		created++;
		deps.onCreated?.(id);
	}
	return created;
}

/** Overlapping calls share the run in progress, so the buffer is never filled twice at once. */
export function singleFlight<A extends unknown[], T>(run: (...args: A) => Promise<T>): (...args: A) => Promise<T> {
	let running: Promise<T> | null = null;
	return (...args) => {
		running ??= run(...args).finally(() => (running = null));
		return running;
	};
}
