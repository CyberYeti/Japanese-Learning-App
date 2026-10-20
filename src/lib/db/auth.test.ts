import { describe, expect, it, vi } from 'vitest';
import { magicLinkRedirectUrl, signInWithMagicLink } from './auth';

describe('magicLinkRedirectUrl', () => {
	it('joins origin and root path', () => {
		expect(magicLinkRedirectUrl('https://user.github.io', '/Japanese-Learning-App/')).toBe(
			'https://user.github.io/Japanese-Learning-App/'
		);
	});

	it('works at the site root (localhost)', () => {
		expect(magicLinkRedirectUrl('http://localhost:5173', '/')).toBe('http://localhost:5173/');
	});
});

describe('signInWithMagicLink', () => {
	const client = (error: { message: string } | null) => ({
		auth: { signInWithOtp: vi.fn().mockResolvedValue({ error }) }
	});

	it('sends the email with the redirect url', async () => {
		const c = client(null);
		const result = await signInWithMagicLink(c, ' me@example.com ', 'http://x/');
		expect(c.auth.signInWithOtp).toHaveBeenCalledWith({
			email: 'me@example.com',
			options: { emailRedirectTo: 'http://x/' }
		});
		expect(result).toEqual({ ok: true });
	});

	it('rejects an empty email without calling Supabase', async () => {
		const c = client(null);
		expect(await signInWithMagicLink(c, '  ', 'http://x/')).toEqual({
			ok: false,
			message: 'Enter your email address.'
		});
		expect(c.auth.signInWithOtp).not.toHaveBeenCalled();
	});

	it('surfaces Supabase errors', async () => {
		const result = await signInWithMagicLink(client({ message: 'rate limited' }), 'a@b.c', 'http://x/');
		expect(result).toEqual({ ok: false, message: 'rate limited' });
	});
});
