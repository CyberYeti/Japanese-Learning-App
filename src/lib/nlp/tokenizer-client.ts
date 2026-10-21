// Main-thread side of the tokenizer worker: promise-based calls over postMessage.
import { asset } from '$app/paths';
import type { Analysis } from './content';
import type { Token } from './tokenize';
import type { WorkerRequest, WorkerResponse } from './tokenizer-protocol';

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void };
type Request = { type: 'init' } | { type: 'tokenize' | 'analyze'; text: string };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
	if (worker) return worker;
	worker = new Worker(new URL('./tokenizer.worker.ts', import.meta.url), { type: 'module' });
	worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
		const call = pending.get(data.id);
		if (!call) return;
		pending.delete(data.id);
		if (data.type === 'error') call.reject(new Error(data.message));
		else call.resolve(data);
	};
	worker.onerror = (event) => {
		const error = new Error(event.message || 'Tokenizer worker crashed');
		for (const call of pending.values()) call.reject(error);
		pending.clear();
		// Start a fresh worker on the next call instead of posting to a dead one.
		worker?.terminate();
		worker = null;
	};
	return worker;
}

function send(req: Request): Promise<WorkerResponse> {
	const id = nextId++;
	// asset() only accepts real static files, so resolve the folder from one of them.
	const dictUrl = new URL('.', new URL(asset('kuromoji/base.dat.gz'), location.href)).href;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject });
		getWorker().postMessage({ ...req, id, dictUrl } satisfies WorkerRequest);
	});
}

/** Start loading the dictionary; resolves once the tokenizer is ready. */
export async function initTokenizer(): Promise<void> {
	await send({ type: 'init' });
}

export async function tokenize(text: string): Promise<Token[]> {
	const res = await send({ type: 'tokenize', text });
	if (res.type !== 'tokens') throw new Error(`Unexpected tokenizer response: ${res.type}`);
	return res.tokens;
}

/** Tokens plus vocab keys (nlp/content.ts), for coverage checks. */
export async function analyze(text: string): Promise<Analysis> {
	const res = await send({ type: 'analyze', text });
	if (res.type !== 'analysis') throw new Error(`Unexpected tokenizer response: ${res.type}`);
	return res.analysis;
}
