import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings, parseInterestTags } from './settings';

describe('parseInterestTags', () => {
	it('splits on commas, Japanese commas and new lines, dropping blanks and repeats', () => {
		expect(parseInterestTags(' trains, Cats、野球\n\n cats ,')).toEqual(['trains', 'Cats', '野球']);
	});

	it('caps the number and length of tags', () => {
		expect(parseInterestTags(Array.from({ length: 30 }, (_, i) => `t${i}`).join(','))).toHaveLength(20);
		expect(parseInterestTags('x'.repeat(100))[0]).toHaveLength(40);
	});
});

describe('normalizeSettings', () => {
	it('gives the defaults with no saved row', () => {
		expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
	});

	it('keeps valid values', () => {
		const settings = {
			interest_tags: ['trains'],
			politeness: 'mixed' as const,
			daily_new_words: 5,
			known_kanji_threshold: 2,
			coverage_threshold: 0.9
		};
		expect(normalizeSettings(settings)).toEqual(settings);
	});

	it('clamps numbers into range, rounds counts, and replaces invalid values with defaults', () => {
		expect(
			normalizeSettings({
				interest_tags: 'trains',
				politeness: 'rude',
				daily_new_words: 500,
				known_kanji_threshold: 2.6,
				coverage_threshold: Number.NaN
			})
		).toEqual({ ...DEFAULT_SETTINGS, daily_new_words: 50, known_kanji_threshold: 3 });
		expect(normalizeSettings({ daily_new_words: -1, known_kanji_threshold: 0, coverage_threshold: 0.2 })).toMatchObject({
			daily_new_words: 0,
			known_kanji_threshold: 1,
			coverage_threshold: 0.5
		});
	});
});
