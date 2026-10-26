import { describe, expect, it } from 'vitest';
import { autoKnownKanji, isKanjiKnown, kanjiKnowledge, toggleKanji } from './kanji';

const words = ['食べる|たべる', '食事|しょくじ', '食堂|しょくどう', '学生|がくせい', '学校|がっこう', '人々|ひとびと'];

describe('autoKnownKanji', () => {
	it('knows a kanji once enough distinct known words use it', () => {
		expect([...autoKnownKanji(words, 3)]).toEqual(['食']);
		expect([...autoKnownKanji(words, 2)].sort()).toEqual(['学', '食'].sort());
	});

	it('counts a word once even if it repeats a kanji or is listed twice', () => {
		expect([...autoKnownKanji(['人々|ひとびと', '人々|ひとびと', '人|ひと'], 2)]).toEqual(['人']);
		expect([...autoKnownKanji(['人々|ひとびと'], 2)]).toEqual([]);
	});

	it('only looks at the spelling, not the reading', () => {
		expect([...autoKnownKanji(['たべる|食', 'たべる|食', 'のむ|食'], 1)]).toEqual([]);
	});
});

describe('kanji overrides', () => {
	const knowledge = kanjiKnowledge(words, [{ kanji: '学', known: true }, { kanji: '食', known: false }], 3);

	it('lets a manual status win over the automatic one', () => {
		expect(isKanjiKnown(knowledge, '学')).toBe(true);
		expect(isKanjiKnown(knowledge, '食')).toBe(false);
		expect(isKanjiKnown(knowledge, '校')).toBe(false);
	});

	it('sets manual_override when a tap moves a kanji away from its automatic status', () => {
		const auto = kanjiKnowledge(words, [], 3);
		const known = toggleKanji(auto, '校');
		expect(known.row).toEqual({ item_type: 'kanji', item_key: '校', status: 'known', manual_override: true });
		expect(isKanjiKnown(known.knowledge, '校')).toBe(true);

		const unknown = toggleKanji(auto, '食');
		expect(unknown.row).toEqual({ item_type: 'kanji', item_key: '食', status: 'learning', manual_override: true });
		expect(isKanjiKnown(unknown.knowledge, '食')).toBe(false);
	});

	it('clears manual_override when a second tap moves it back, so the automatic rule applies again', () => {
		const first = toggleKanji(kanjiKnowledge(words, [], 3), '校');
		const second = toggleKanji(first.knowledge, '校');
		expect(second.row).toEqual({ item_type: 'kanji', item_key: '校', status: 'learning', manual_override: false });
		expect(second.knowledge.overrides.has('校')).toBe(false);
		expect(first.knowledge.overrides.get('校')).toBe(true);
	});
});
