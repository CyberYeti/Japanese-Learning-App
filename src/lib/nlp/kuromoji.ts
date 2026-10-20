// Builds a kuromoji tokenizer from IPADIC files supplied by the caller, so the browser worker
// (fetch + Cache API) and Node scripts/tests (fs) share one loader. kuromoji's own loaders use
// XHR and Node's `path`, neither of which suits a Vite-bundled worker.
import DynamicDictionaries from 'kuromoji/src/dict/DynamicDictionaries.js';
import Tokenizer from 'kuromoji/src/Tokenizer.js';
import type { IpadicFeatures } from 'kuromoji';

export interface KuromojiTokenizer {
	tokenize(text: string): IpadicFeatures[];
}

/** Returns the decompressed contents of one IPADIC file, e.g. `base.dat.gz`. */
export type LoadDictFile = (file: string) => Promise<ArrayBuffer>;

export const DICT_FILES = [
	'base.dat.gz',
	'check.dat.gz',
	'tid.dat.gz',
	'tid_pos.dat.gz',
	'tid_map.dat.gz',
	'cc.dat.gz',
	'unk.dat.gz',
	'unk_pos.dat.gz',
	'unk_map.dat.gz',
	'unk_char.dat.gz',
	'unk_compat.dat.gz',
	'unk_invoke.dat.gz'
] as const;

export async function buildTokenizer(load: LoadDictFile): Promise<KuromojiTokenizer> {
	const [base, check, tid, tidPos, tidMap, cc, unk, unkPos, unkMap, unkChar, unkCompat, unkInvoke] =
		await Promise.all(DICT_FILES.map(load));

	const dic = new DynamicDictionaries();
	dic.loadTrie(new Int32Array(base), new Int32Array(check));
	dic.loadTokenInfoDictionaries(new Uint8Array(tid), new Uint8Array(tidPos), new Uint8Array(tidMap));
	dic.loadConnectionCosts(new Int16Array(cc));
	dic.loadUnknownDictionaries(
		new Uint8Array(unk),
		new Uint8Array(unkPos),
		new Uint8Array(unkMap),
		new Uint8Array(unkChar),
		new Uint32Array(unkCompat),
		new Uint8Array(unkInvoke)
	);
	return new Tokenizer(dic);
}
