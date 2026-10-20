import { describe, expect, it, vi } from 'vitest';
import { createDictionary, type DictEntry } from './lookup';

const taberu: DictEntry = {
	id: '1358280',
	kanji: ['食べる', '喰べる'],
	kana: ['たべる'],
	senses: [{ pos: ['v1', 'vt'], gloss: ['to eat'] }]
};
const shokuji: DictEntry = {
	id: '1358490',
	kanji: ['食事'],
	kana: ['しょくじ'],
	senses: [{ pos: ['n', 'vs'], gloss: ['meal'] }]
};

// Shards are keyed by the hex code point of the headword's first character: 食 → 98df, た → 305f.
const shards: Record<string, DictEntry[]> = {
	'/data/dict/98df.json': [taberu, shokuji],
	'/data/dict/305f.json': [taberu]
};

function fakeFetch() {
	return vi.fn(async (url: string) => {
		const shard = shards[url];
		return shard
			? new Response(JSON.stringify(shard))
			: new Response('Not found', { status: 404 });
	});
}

describe('createDictionary().lookup', () => {
	it('finds a word by its kanji headword in the shard for its first character', async () => {
		const dict = createDictionary('/data/dict', fakeFetch());
		expect(await dict.lookup('食べる')).toEqual([taberu]);
	});

	it('returns nothing when no shard exists for the first character', async () => {
		const dict = createDictionary('/data/dict', fakeFetch());
		expect(await dict.lookup('ググる')).toEqual([]);
	});

	it('fetches each shard only once', async () => {
		const fetchFn = fakeFetch();
		const dict = createDictionary('/data/dict', fetchFn);
		await Promise.all([dict.lookup('食べる'), dict.lookup('食事')]);
		expect(await dict.lookup('食事')).toEqual([shokuji]);
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});
});
