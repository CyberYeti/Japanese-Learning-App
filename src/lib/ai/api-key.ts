// The Gemini key lives only in this browser's localStorage (SPEC §2), never in a file or the database.
const STORAGE_KEY = 'gemini-api-key';

type KeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The saved key, or '' when none is saved or storage is blocked (e.g. private browsing). */
export function loadApiKey(storage: KeyStorage = localStorage): string {
	try {
		return storage.getItem(STORAGE_KEY) ?? '';
	} catch {
		return '';
	}
}

/** Save the key; an empty key removes it. Throws if storage is blocked, so the caller can say so. */
export function saveApiKey(key: string, storage: KeyStorage = localStorage): void {
	const trimmed = key.trim();
	if (trimmed) storage.setItem(STORAGE_KEY, trimmed);
	else storage.removeItem(STORAGE_KEY);
}
