export type AuthResult = { ok: true } | { ok: false; message: string };

interface OtpClient {
	auth: {
		signInWithOtp(args: {
			email: string;
			options: { emailRedirectTo: string };
		}): Promise<{ error: { message: string } | null }>;
	};
}

/** Where Supabase sends the user after they click the magic link. */
export function magicLinkRedirectUrl(origin: string, rootPath: string): string {
	return `${origin}${rootPath}`;
}

export async function signInWithMagicLink(
	client: OtpClient,
	email: string,
	redirectTo: string
): Promise<AuthResult> {
	const trimmed = email.trim();
	if (!trimmed) return { ok: false, message: 'Enter your email address.' };
	const { error } = await client.auth.signInWithOtp({
		email: trimmed,
		options: { emailRedirectTo: redirectTo }
	});
	return error ? { ok: false, message: error.message } : { ok: true };
}
