import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

// Placeholder values keep the app loadable (showing a config notice) when env vars are missing.
export const supabase = createClient(
	url || 'http://localhost:54321',
	anonKey || 'missing-anon-key'
);
