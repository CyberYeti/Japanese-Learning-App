import { describe, expect, it, vi } from 'vitest';
import { generateJson, IncompleteReplyError } from './generate';

const reply = (body: unknown, status = 200) =>
	vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

const candidate = (text: string, finishReason = 'STOP') => ({
	candidates: [{ content: { parts: [{ text }] }, finishReason }]
});

const schema = { type: 'object', properties: { title: { type: 'string' } } };

describe('generateJson', () => {
	it('posts the prompt and schema with the key in a header, and parses the JSON reply', async () => {
		const fetchFn = reply(candidate('{"title":"週末"}'));
		const result = await generateJson('Write a passage', schema, { apiKey: 'k-123', fetch: fetchFn });

		expect(result).toEqual({ title: '週末' });
		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/.+:generateContent$/);
		expect(url).not.toContain('k-123');
		expect(init.method).toBe('POST');
		expect(init.headers['x-goog-api-key']).toBe('k-123');
		expect(JSON.parse(init.body)).toEqual({
			contents: [{ role: 'user', parts: [{ text: 'Write a passage' }] }],
			generationConfig: {
				responseMimeType: 'application/json',
				responseJsonSchema: schema,
				thinkingConfig: { thinkingLevel: 'minimal' }
			}
		});
	});

	it('waits and retries when Gemini is briefly unavailable', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(new Response('{}', { status: 503 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(candidate('{"title":"週末"}'))));
		const result = await generateJson('p', schema, { apiKey: 'k', fetch: fetchFn, retryDelaysMs: [0] });
		expect(result).toEqual({ title: '週末' });
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});

	it('gives up once the retries run out', async () => {
		const fetchFn = vi.fn().mockImplementation(async () => new Response('{}', { status: 503 }));
		await expect(generateJson('p', schema, { apiKey: 'k', fetch: fetchFn, retryDelaysMs: [0, 0] })).rejects.toThrow('(503)');
		expect(fetchFn).toHaveBeenCalledTimes(3);
	});

	it("doesn't retry errors that waiting won't fix", async () => {
		const fetchFn = reply({ error: { message: 'API key not valid.' } }, 400);
		await expect(generateJson('p', schema, { apiKey: 'k', fetch: fetchFn, retryDelaysMs: [0] })).rejects.toThrow();
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it("surfaces the API's error message", async () => {
		const fetchFn = reply({ error: { message: 'API key not valid.' } }, 400);
		await expect(generateJson('p', schema, { apiKey: 'bad', fetch: fetchFn })).rejects.toThrow(
			'Gemini request failed (400): API key not valid.'
		);
	});

	it('rejects a blocked prompt', async () => {
		const fetchFn = reply({ promptFeedback: { blockReason: 'SAFETY' } });
		await expect(generateJson('p', schema, { apiKey: 'k', fetch: fetchFn })).rejects.toThrow('blocked the prompt: SAFETY');
	});

	it('rejects a reply cut off before the JSON finished as incomplete', async () => {
		const fetchFn = reply(candidate('{"title":', 'MAX_TOKENS'));
		const call = generateJson('p', schema, { apiKey: 'k', fetch: fetchFn });
		await expect(call).rejects.toThrow('MAX_TOKENS');
		await expect(call).rejects.toBeInstanceOf(IncompleteReplyError);
	});

	it('rejects malformed JSON as incomplete', async () => {
		const fetchFn = reply(candidate('{"title": 週末}'));
		await expect(generateJson('p', schema, { apiKey: 'k', fetch: fetchFn })).rejects.toBeInstanceOf(IncompleteReplyError);
	});

	it('refuses to call without a key', async () => {
		const fetchFn = reply(candidate('{}'));
		await expect(generateJson('p', schema, { apiKey: ' ', fetch: fetchFn })).rejects.toThrow(/API key/);
		expect(fetchFn).not.toHaveBeenCalled();
	});
});
