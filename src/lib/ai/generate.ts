// The only module that knows about Gemini (SPEC §6): switching models or providers happens here.

// Pinned rather than gemini-flash-latest: Flash models think by default, and the thinking levels
// each one accepts differ, so the alias moving could slow every call or reject the config.
const MODEL = 'gemini-3.6-flash';
// The app checks every passage in code, so the model needs little reasoning; more thinking cost
// minutes per passage.
const THINKING_LEVEL = 'minimal';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>;

export interface GenerateOptions {
	apiKey: string;
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
async function post(fetchFn: FetchFn, init: Parameters<FetchFn>[1]): Promise<{ res: Response; reply: GeminiReply }> {
	const started = performance.now();
	const res = await fetchFn(ENDPOINT, init);
	const reply: GeminiReply = await res.json().catch(() => ({}));
	const u = reply.usageMetadata;
	console.info(
		`Gemini ${MODEL}: ${res.status} in ${Math.round(performance.now() - started)} ms, tokens in ` +
			`${u?.promptTokenCount ?? '?'}, thinking ${u?.thoughtsTokenCount ?? 0}, out ${u?.candidatesTokenCount ?? '?'}`
	);
	return { res, reply };
}

/** Ask the model for JSON fitting `schema`, a standard JSON Schema. */
export async function generateJson(prompt: string, schema: object, options: GenerateOptions): Promise<unknown> {
	const apiKey = options.apiKey.trim();
	if (!apiKey) throw new Error('No Gemini API key set.');
	const fetchFn = options.fetch ?? ((url, init) => fetch(url, init));

	const init = {
		method: 'POST',
		// In a header rather than the URL, so the key stays out of logs and history.
		headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
		body: JSON.stringify({
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
			generationConfig: {
				responseMimeType: 'application/json',
				responseJsonSchema: schema,
				thinkingConfig: { thinkingLevel: THINKING_LEVEL }
			}
		})
	};

	let { res, reply } = await post(fetchFn, init);
	for (const delay of options.retryDelaysMs ?? RETRY_DELAYS_MS) {
		if (!TRANSIENT_STATUSES.has(res.status)) break;
		await new Promise((resolve) => setTimeout(resolve, delay));
		({ res, reply } = await post(fetchFn, init));
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
