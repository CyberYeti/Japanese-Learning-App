import { describe, expect, it } from 'vitest';
import { fillBuffer, MAX_READY_AGE_MS, planBuffer, singleFlight, type ReadyPassage } from './buffer';

const now = new Date('2026-10-25T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
const passage = (id: string, ageHours: number): ReadyPassage => ({ id, created_at: hoursAgo(ageHours) });

describe('planBuffer', () => {
	it('asks for two passages when none are ready', () => {
		expect(planBuffer([], now)).toEqual({ expired: [], missing: 2 });
	});

	it('asks for nothing when two fresh passages are ready', () => {
		expect(planBuffer([passage('a', 1), passage('b', 23)], now)).toEqual({ expired: [], missing: 0 });
	});

	it('expires passages older than 24 hours and replaces them', () => {
		expect(planBuffer([passage('old', 25), passage('new', 2)], now)).toEqual({ expired: ['old'], missing: 1 });
	});

	it('keeps a passage exactly 24 hours old', () => {
		const edge = { id: 'edge', created_at: new Date(now.getTime() - MAX_READY_AGE_MS).toISOString() };
		expect(planBuffer([edge], now).expired).toEqual([]);
	});

	it('never asks for a negative number when more than enough are ready', () => {
		expect(planBuffer([passage('a', 1), passage('b', 2), passage('c', 3)], now).missing).toBe(0);
	});
});

/** An in-memory passages table: create() adds a fresh ready passage. */
function store(initial: ReadyPassage[], options: { failOn?: number } = {}) {
	let rows = [...initial];
	const deleted: string[] = [];
	let calls = 0;
	return {
		get rows() {
			return rows;
		},
		deleted,
		deps: {
			now: () => now,
			listReady: async () => [...rows],
			deleteReady: async (ids: string[]) => {
				deleted.push(...ids);
				rows = rows.filter((r) => !ids.includes(r.id));
			},
			create: async () => {
				calls++;
				if (calls === options.failOn) throw new Error('Gemini request failed (429)');
				const id = `gen${calls}`;
				rows.push(passage(id, 0));
				return id;
			}
		}
	};
}

describe('fillBuffer', () => {
	it('fills an empty buffer with two passages', async () => {
		const s = store([]);
		expect(await fillBuffer(s.deps)).toBe(2);
		expect(s.rows.map((r) => r.id)).toEqual(['gen1', 'gen2']);
	});

	it('replaces the passage just read with one more', async () => {
		const s = store([passage('a', 3)]);
		expect(await fillBuffer(s.deps)).toBe(1);
	});

	it('deletes expired passages before replacing them', async () => {
		const s = store([passage('old', 30), passage('fresh', 1)]);
		await fillBuffer(s.deps);
		expect(s.deleted).toEqual(['old']);
		expect(s.rows.map((r) => r.id)).toEqual(['fresh', 'gen1']);
	});

	it('does nothing when the buffer is full', async () => {
		const s = store([passage('a', 1), passage('b', 1)]);
		expect(await fillBuffer(s.deps)).toBe(0);
		expect(s.deleted).toEqual([]);
	});

	it('counts a passage saved elsewhere while it was generating', async () => {
		const s = store([]);
		const create = s.deps.create;
		// The home page generates one for a waiting reader while the first background passage is written.
		s.deps.create = async () => {
			const id = await create();
			s.rows.push(passage('on-demand', 0));
			return id;
		};
		expect(await fillBuffer(s.deps)).toBe(1);
		expect(s.rows).toHaveLength(2);
	});

	it('stops at the first failure', async () => {
		const s = store([], { failOn: 1 });
		await expect(fillBuffer(s.deps)).rejects.toThrow('429');
		expect(s.rows).toEqual([]);
	});

	it('reports each saved passage', async () => {
		const s = store([]);
		const created: string[] = [];
		await fillBuffer({ ...s.deps, onCreated: (id) => created.push(id) });
		expect(created).toEqual(['gen1', 'gen2']);
	});
});

describe('singleFlight', () => {
	it('shares a run in progress, then starts a new one once it settles', async () => {
		let runs = 0;
		let finish!: () => void;
		const run = singleFlight(() => {
			runs++;
			return new Promise<number>((resolve) => (finish = () => resolve(runs)));
		});
		const first = run();
		const second = run();
		expect(second).toBe(first);
		finish();
		expect(await first).toBe(1);
		run();
		expect(runs).toBe(2);
	});

	it('starts again after a failed run', async () => {
		let runs = 0;
		const run = singleFlight(async () => {
			runs++;
			throw new Error('offline');
		});
		await expect(run()).rejects.toThrow('offline');
		await expect(run()).rejects.toThrow('offline');
		expect(runs).toBe(2);
	});
});
