/** One JMdict entry, trimmed from the jmdict-simplified format. */
export interface DictEntry {
	id: string;
	kanji: string[];
	kana: string[];
	senses: { pos: string[]; gloss: string[] }[];
}

export interface Dictionary {
	lookup(word: string): Promise<DictEntry[]>;
}

/** Shard file name for a word: hex code point of its first character (食べる → 98df). */
export function shardKey(word: string): string {
	return word.codePointAt(0)!.toString(16);
}

type FetchFn = (url: string) => Promise<Response>;

export function createDictionary(baseUrl: string, fetchFn: FetchFn = (url) => fetch(url)): Dictionary {
	const shards = new Map<string, Promise<DictEntry[]>>();

	async function fetchShard(key: string): Promise<DictEntry[]> {
		const res = await fetchFn(`${baseUrl}/${key}.json`);
		if (res.status === 404) return [];
		if (!res.ok) throw new Error(`Dictionary shard ${key} failed: ${res.status}`);
		return res.json();
	}

	function loadShard(key: string): Promise<DictEntry[]> {
		let shard = shards.get(key);
		if (!shard) {
			shard = fetchShard(key);
			// Don't cache failures, so a later tap can retry.
			shard.catch(() => shards.delete(key));
			shards.set(key, shard);
		}
		return shard;
	}

	return {
		async lookup(word) {
			if (!word) return [];
			const entries = await loadShard(shardKey(word));
			return entries.filter((e) => e.kanji.includes(word) || e.kana.includes(word));
		}
	};
}
