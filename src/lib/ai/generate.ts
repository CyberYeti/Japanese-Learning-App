// The only module that knows about Gemini (SPEC §6): switching models or providers happens here.

// Pinned rather than gemini-flash-latest: Flash models think by default, and the thinking levels
// each one accepts differ, so the alias moving could slow every call or reject the config.
// 3.8 writes noticeably better Japanese, but can't think less than 'low'; 3.6 at 'minimal' is
// several times faster but makes the odd grammar slip, so it's for when the reader is waiting.
const MODELS = {
	quality: { name: 'gemini-3.8-flash', thinkingLevel: 'low' },
	speed: { name: 'gemini-3.6-flash', thinkingLevel: 'minimal' }
} as const;

export type Priority = keyof typeof MODELS;

const endpoint = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>;

export interface GenerateOptions {
	apiKey: string;
	/** 'speed' when someone is waiting on the reply; defaults to 'quality'. */
	priority?: Priority;
	fetch?: FetchFn;
	/** Waits before each retry of a transient server error; one retry per entry. */
	retryDelaysMs?: number[];
}

// Overloaded or briefly failing servers; worth waiting for. 429 means quota, which waiting a few
// seconds won't restore.
const TRANSIENT_STATUSES = new Set([500, 503, 504]);
const RETRY_DELAYS_MS = [1000, 3000];

/** The model answered, but not with complete JSON (cut off, or malformed). Asking again may work. */
export class IncompleteReplyError extends Error {}

interface GeminiReply {
	candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
	promptFeedback?: { blockReason?: string };
	usageMetadata?: { promptTokenCount?: number; thoughtsTokenCount?: number; candidatesTokenCount?: number };
	error?: { message?: string };
}

/** One request, logged so slow or failing calls show up in the console. */
async function post(fetchFn: FetchFn, model: string, init: Parameters<FetchFn>[1]): Promise<{ res: Response; reply: GeminiReply }> {
	const started = performance.now();
	const res = await fetchFn(endpoint(model), init);
	const reply: GeminiReply = await res.json().catch(() => ({}));
	const u = reply.usageMetadata;
	console.info(
		`Gemini ${model}: ${res.status} in ${Math.round(performance.now() - started)} ms, tokens in ` +
			`${u?.promptTokenCount ?? '?'}, thinking ${u?.thoughtsTokenCount ?? 0}, out ${u?.candidatesTokenCount ?? '?'}`
	);
	return { res, reply };
}

/** Call one model, retrying transient server errors. */
async function postWithRetries(
	prompt: string,
	schema: object,
	priority: Priority,
	apiKey: string,
	fetchFn: FetchFn,
	retryDelaysMs: number[]
) {
	const { name, thinkingLevel } = MODELS[priority];
	const init = {
		method: 'POST',
		// In a header rather than the URL, so the key stays out of logs and history.
		headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
		body: JSON.stringify({
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
			generationConfig: {
				responseMimeType: 'application/json',
				responseJsonSchema: schema,
				thinkingConfig: { thinkingLevel }
			}
		})
	};

	let result = await post(fetchFn, name, init);
	for (const delay of retryDelaysMs) {
		if (!TRANSIENT_STATUSES.has(result.res.status)) break;
		await new Promise((resolve) => setTimeout(resolve, delay));
		result = await post(fetchFn, name, init);
	}
	return result;
}

/** Ask the model for JSON fitting `schema`, a standard JSON Schema. */
export async function generateJson(prompt: string, schema: object, options: GenerateOptions): Promise<unknown> {
	const apiKey = options.apiKey.trim();
	if (!apiKey) throw new Error('No Gemini API key set.');
	const fetchFn = options.fetch ?? ((url, init) => fetch(url, init));
	const retryDelaysMs = options.retryDelaysMs ?? RETRY_DELAYS_MS;
	const priority = options.priority ?? 'quality';

	let { res, reply } = await postWithRetries(prompt, schema, priority, apiKey, fetchFn, retryDelaysMs);
	// A rougher passage beats none when the better model stays overloaded.
	if (priority === 'quality' && TRANSIENT_STATUSES.has(res.status)) {
		({ res, reply } = await postWithRetries(prompt, schema, 'speed', apiKey, fetchFn, retryDelaysMs));
	}
	if (!res.ok) throw new Error(`Gemini request failed (${res.status}): ${reply.error?.message ?? res.statusText}`);
	if (reply.promptFeedback?.blockReason) throw new Error(`Gemini blocked the prompt: ${reply.promptFeedback.blockReason}`);

	const [candidate] = reply.candidates ?? [];
	const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('');
	if (candidate?.finishReason !== 'STOP' || !text) {
		throw new IncompleteReplyError(`Gemini gave no complete reply (finish reason: ${candidate?.finishReason ?? 'none'})`);
	}
	try {
		return JSON.parse(text);
	} catch {
		throw new IncompleteReplyError('Gemini replied with malformed JSON');
	}
}
