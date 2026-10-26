// Typed Supabase queries for the learner's settings row.
import { normalizeSettings, type Settings } from '../settings/settings';
import { supabase } from './supabase';

const COLUMNS = 'interest_tags, politeness, daily_new_words, known_kanji_threshold, coverage_threshold';

/** The saved settings, or the defaults before any are saved. */
export async function loadSettings(): Promise<Settings> {
	const { data, error } = await supabase.from('settings').select(COLUMNS).maybeSingle();
	if (error) throw new Error(`Loading settings failed: ${error.message}`);
	return normalizeSettings(data);
}

/** Save the settings (normalized first); returns what was saved. */
export async function saveSettings(settings: Settings): Promise<Settings> {
	const { data, error } = await supabase
		.from('settings')
		.upsert(normalizeSettings(settings), { onConflict: 'user_id' })
		.select(COLUMNS)
		.single();
	if (error) throw new Error(`Saving settings failed: ${error.message}`);
	return normalizeSettings(data);
}
