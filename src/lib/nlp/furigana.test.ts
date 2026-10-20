import { describe, expect, it } from 'vitest';
import { alignFurigana } from './furigana';

describe('alignFurigana', () => {
	it('puts the reading over the kanji root without repeating okurigana', () => {
		expect(alignFurigana('食べる', 'たべる')).toEqual([
			{ text: '食', ruby: 'た' },
			{ text: 'べる' }
		]);
	});

	it('splits readings across several kanji runs', () => {
		expect(alignFurigana('取り扱い', 'とりあつかい')).toEqual([
			{ text: '取', ruby: 'と' },
			{ text: 'り' },
			{ text: '扱', ruby: 'あつか' },
			{ text: 'い' }
		]);
	});

	it('accepts katakana readings as kuromoji returns them', () => {
		expect(alignFurigana('お茶', 'オチャ')).toEqual([{ text: 'お' }, { text: '茶', ruby: 'ちゃ' }]);
	});

	it('gives a compound its whole reading', () => {
		expect(alignFurigana('映画', 'エイガ')).toEqual([{ text: '映画', ruby: 'えいが' }]);
	});

	it('leaves kana-only words without ruby', () => {
		expect(alignFurigana('テレビ', 'テレビ')).toEqual([{ text: 'テレビ' }]);
	});

	it('falls back to ruby over the whole word when the reading does not fit the kana', () => {
		expect(alignFurigana('今日は', 'きょうわ')).toEqual([{ text: '今日は', ruby: 'きょうわ' }]);
	});
});
