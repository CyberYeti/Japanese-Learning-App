import type { Analysis } from './content';
import type { Token } from './tokenize';

/** Every request carries the dictionary URL so the worker can lazily build itself. */
export type WorkerRequest =
	| { type: 'init'; id: number; dictUrl: string }
	| { type: 'tokenize'; id: number; dictUrl: string; text: string }
	| { type: 'analyze'; id: number; dictUrl: string; text: string };

export type WorkerResponse =
	| { type: 'ready'; id: number }
	| { type: 'tokens'; id: number; tokens: Token[] }
	| { type: 'analysis'; id: number; analysis: Analysis }
	| { type: 'error'; id: number; message: string };
