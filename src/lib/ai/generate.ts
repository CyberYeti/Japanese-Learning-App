// The only module that knows about Gemini (SPEC §6): switching models or providers happens here.

// Google's alias for its current Flash model, so a model retirement doesn't break the app.
const MODEL = 'gemini-flash-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>;

export interface GenerateOptions {
	apiKey: string;
	fetch?: FetchFn;
}

/** The model answered, but not with complete JSON (cut off, or malformed). Asking again may work. */
export class IncompleteReplyError extends Error {}

interface GeminiReply {
	candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
	promptFeedback?: { blockReason?: string };
	error?: { message?: string };
}

/** Ask the model for JSON fitting `schema`, a standard JSON Schema. */
export async function generateJson(prompt: string, schema: object, options: GenerateOptions): Promise<unknown> {
	const apiKey = options.apiKey.trim();
	if (!apiKey) throw new Error('No Gemini API key set.');
	const fetchFn = options.fetch ?? ((url, init) => fetch(url, init));

	const res = await fetchFn(ENDPOINT, {
		method: 'POST',
		// In a header rather than the URL, so the key stays out of logs and history.
		headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
		body: JSON.stringify({
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
			generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema }
		})
	});
	const reply: GeminiReply = await res.json().catch(() => ({}));
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
