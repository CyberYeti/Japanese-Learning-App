import { describe, expect, it } from 'vitest';
import { loadApiKey, saveApiKey } from './api-key';

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
	const data = new Map<string, string>();
	return {
		getItem: (k) => data.get(k) ?? null,
		setItem: (k, v) => void data.set(k, v),
		removeItem: (k) => void data.delete(k)
	};
}

describe('api key storage', () => {
	it('round-trips a trimmed key', () => {
		const storage = memoryStorage();
		saveApiKey('  AIza-123 ', storage);
		expect(loadApiKey(storage)).toBe('AIza-123');
	});

	it('clears the key when saved empty', () => {
		const storage = memoryStorage();
		saveApiKey('AIza-123', storage);
		saveApiKey('   ', storage);
		expect(loadApiKey(storage)).toBe('');
	});

	it('reads as empty when storage is unavailable', () => {
		const broken = { ...memoryStorage(), getItem: () => { throw new Error('denied'); } };
		expect(loadApiKey(broken)).toBe('');
	});
});
