// Matchers check whether a passage actually uses a grammar point (static/data/grammar_points.json).
import type { Token } from './tokenize';

/** One string, or a list where any value will do. */
type OneOf = string | string[];

/** Conditions on a single token; every condition given must hold. */
export interface TokenPattern {
	surface?: OneOf;
	basic_form?: OneOf;
	pos?: OneOf;
	pos_detail?: OneOf;
	/** 連用 matches 連用形, 連用タ接続 and 連用テ接続. */
	conjugated_form_prefix?: OneOf;
	/** The token must not fit this pattern, e.g. a verb that isn't ある. */
	not?: TokenPattern;
}

export interface Matcher {
	/** Alternative token sequences; the grammar is present if any one appears contiguously. */
	sequences: TokenPattern[][];
	/** Fallback for grammar the token patterns miss, tested against the text the tokens spell out. */
	regex?: string;
}

/** One entry of static/data/grammar_points.json. */
export interface GrammarPoint {
	id: string;
	name: string;
	lesson_id: string;
	level: number;
	matcher: Matcher;
	prompt_hint: string;
	/** Sentences from the lesson that show the point; the matcher must fire on each. */
	examples: string[];
	/** です/ます versions the matcher must also fire on, since passages start in polite form. */
	polite_examples?: string[];
	/** Sentences the matcher must not fire on, guarding against patterns that are too broad. */
	counter_examples?: string[];
	/** Set when the matcher can't be made reliable: why, and what it checks instead. */
	unreliable?: string;
}

const toArray = (values: OneOf) => (typeof values === 'string' ? [values] : values);

/** An absent condition allows anything; a present one needs a value that passes `test` for some allowed entry. */
const allows = (allowed: OneOf | undefined, value: string | null, test: (value: string, entry: string) => boolean) =>
	allowed === undefined || (value !== null && toArray(allowed).some((entry) => test(value, entry)));

const equals = (value: string, entry: string) => value === entry;
const startsWith = (value: string, prefix: string) => value.startsWith(prefix);

const fits = (p: TokenPattern, t: Token): boolean =>
	allows(p.surface, t.surface, equals) &&
	allows(p.basic_form, t.basicForm, equals) &&
	allows(p.pos, t.pos, equals) &&
	allows(p.pos_detail, t.posDetail, equals) &&
	allows(p.conjugated_form_prefix, t.conjugatedForm, startsWith) &&
	!(p.not && fits(p.not, t));

const occursAt = (sequence: TokenPattern[], tokens: Token[], start: number) =>
	sequence.every((p, i) => start + i < tokens.length && fits(p, tokens[start + i]));

export function matches(matcher: Matcher, tokens: Token[]): boolean {
	return (
		matcher.sequences.some((sequence) => tokens.some((_, start) => occursAt(sequence, tokens, start))) ||
		(matcher.regex !== undefined && new RegExp(matcher.regex).test(tokens.map((t) => t.surface).join('')))
	);
}
