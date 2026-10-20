import type { Token } from './tokenize';

/** What the learner taps: a content token plus the conjugation endings attached to it. */
export interface Word {
	surface: string;
	head: Token;
	endings: Token[];
}

const conjugates = (t: Token) => t.pos === '動詞' || t.pos === '形容詞';

/** Whether `token` is a conjugation ending that belongs to `word`. */
function attaches(word: Word, token: Token): boolean {
	if (!conjugates(word.head)) return false;
	const previous = word.endings.at(-1);
	switch (token.pos) {
		case '助動詞': // ます, た, ない, たい …
			// です stays its own word (面白い | です), except the でし inside ませんでした.
			return token.basicForm !== 'です' || previous?.basicForm === 'ん';
		case '助詞': // 食べて, 行けば
			return token.posDetail === '接続助詞' && ['て', 'で', 'ば'].includes(token.surface);
		case '動詞':
			// 読まれる / 読ませる, and helpers after て: 食べている, 食べてしまう
			return (
				token.posDetail === '接尾' ||
				(token.posDetail === '非自立' && ['て', 'で'].includes(previous?.surface ?? ''))
			);
		default:
			return false;
	}
}

export interface Conjugation {
	parts: { surface: string; base: string; meaning: string | null }[];
	summary: string;
}

// What each ending contributes, keyed by its dictionary form.
const MEANINGS: Record<string, string> = {
	ます: 'polite',
	です: 'polite',
	た: 'past',
	だ: 'past', // 読んだ
	ない: 'negative',
	ん: 'negative', // ません
	ぬ: 'negative',
	たい: 'want to',
	う: 'volitional (let’s)',
	よう: 'volitional (let’s)',
	れる: 'passive / potential',
	られる: 'passive / potential',
	せる: 'causative',
	させる: 'causative',
	ば: 'conditional (if)',
	て: 'te-form',
	で: 'te-form',
	いる: 'ongoing (〜ている)',
	しまう: 'completed / regret (〜てしまう)',
	おく: 'in advance (〜ておく)',
	みる: 'try (〜てみる)'
};

export function describeConjugation(word: Word): Conjugation | null {
	if (!word.endings.length) return null;
	const parts = word.endings.map((t, i) => {
		// The て in 食べている only links to いる; the helper carries the meaning.
		const linksHelper = t.pos === '助詞' && word.endings[i + 1]?.pos === '動詞';
		return {
			surface: t.surface,
			base: t.basicForm,
			meaning: linksHelper ? null : (MEANINGS[t.basicForm] ?? null)
		};
	});
	const meanings = parts.map((p) => p.meaning).filter((m) => m !== null);
	return { parts, summary: [...new Set(meanings)].join(', ') };
}

/**
 * Group kuromoji's morphemes into learner-sized words: 見 + まし + た → 見ました.
 * The tokens stay available on each word for grammar matching and coverage.
 */
export function groupWords(tokens: Token[]): Word[] {
	const words: Word[] = [];
	for (const token of tokens) {
		const last = words.at(-1);
		if (last && attaches(last, token)) {
			last.endings.push(token);
			last.surface += token.surface;
		} else {
			words.push({ surface: token.surface, head: token, endings: [] });
		}
	}
	return words;
}
