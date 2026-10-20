// kuromoji ships untyped CommonJS internals; we import two of them directly (see kuromoji.ts).
declare module 'kuromoji/src/dict/DynamicDictionaries.js' {
	export default class DynamicDictionaries {
		loadTrie(base: Int32Array, check: Int32Array): this;
		loadTokenInfoDictionaries(tokenInfo: Uint8Array, pos: Uint8Array, targetMap: Uint8Array): this;
		loadConnectionCosts(cc: Int16Array): this;
		loadUnknownDictionaries(
			unk: Uint8Array,
			unkPos: Uint8Array,
			unkMap: Uint8Array,
			catMap: Uint8Array,
			compatCatMap: Uint32Array,
			invokeDef: Uint8Array
		): this;
	}
}

declare module 'kuromoji/src/Tokenizer.js' {
	import type { IpadicFeatures } from 'kuromoji';
	import type DynamicDictionaries from 'kuromoji/src/dict/DynamicDictionaries.js';
	export default class Tokenizer {
		constructor(dic: DynamicDictionaries);
		tokenize(text: string): IpadicFeatures[];
	}
}
