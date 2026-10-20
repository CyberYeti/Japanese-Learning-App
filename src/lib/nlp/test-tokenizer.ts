// Test helper: a real kuromoji tokenizer built from the IPADIC files the app ships in static/kuromoji/.
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { buildTokenizer, type KuromojiTokenizer } from './kuromoji';

const loadFromStatic = async (file: string) => {
	const bytes = gunzipSync(await readFile(new URL(`../../../static/kuromoji/${file}`, import.meta.url)));
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

export const loadTestTokenizer = (): Promise<KuromojiTokenizer> => buildTokenizer(loadFromStatic);
