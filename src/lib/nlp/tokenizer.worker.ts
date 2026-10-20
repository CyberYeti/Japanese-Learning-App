/// <reference lib="webworker" />
// Dedicated worker that owns kuromoji (ADR 0001): the dictionary build and every tokenize call
// stay off the UI thread. IPADIC files are kept in Cache Storage after the first download.
import { buildTokenizer, type KuromojiTokenizer } from './kuromoji';
import { tokenizeWith } from './tokenize';
import type { WorkerRequest, WorkerResponse } from './tokenizer-protocol';

// Bump when the files in static/kuromoji/ change, so stale copies are not reused.
const CACHE_PREFIX = 'kuromoji-ipadic-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;

// Caching is best-effort: Cache Storage can be missing (insecure context) or full (mobile quota),
// and the tokenizer should still work from the network.
async function openCache(): Promise<Cache | null> {
	try {
		for (const name of await caches.keys()) {
			if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
		}
		return await caches.open(CACHE_NAME);
	} catch {
		return null;
	}
}

let cache: Promise<Cache | null> | null = null;

async function cachedFetch(url: string): Promise<Response> {
	const store = await (cache ??= openCache());
	const hit = await store?.match(url);
	if (hit) return hit;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
	await store?.put(url, res.clone()).catch(() => {});
	return res;
}

async function gunzip(bytes: ArrayBuffer): Promise<ArrayBuffer> {
	// A server that sends Content-Encoding: gzip has already had the browser decompress the file.
	const view = new Uint8Array(bytes, 0, 2);
	if (view[0] !== 0x1f || view[1] !== 0x8b) return bytes;
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
	return new Response(stream).arrayBuffer();
}

let tokenizer: Promise<KuromojiTokenizer> | null = null;

function init(dictUrl: string): Promise<KuromojiTokenizer> {
	tokenizer ??= buildTokenizer(async (file) =>
		gunzip(await (await cachedFetch(new URL(file, dictUrl).href)).arrayBuffer())
	);
	// Let a later request retry if this attempt failed (e.g. offline on first visit).
	tokenizer.catch(() => (tokenizer = null));
	return tokenizer;
}

const post = (msg: WorkerResponse) => self.postMessage(msg);

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
	try {
		const t = await init(data.dictUrl);
		if (data.type === 'init') post({ type: 'ready', id: data.id });
		else post({ type: 'tokens', id: data.id, tokens: tokenizeWith(t, data.text) });
	} catch (err) {
		post({ type: 'error', id: data.id, message: err instanceof Error ? err.message : String(err) });
	}
};
