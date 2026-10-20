# Japanese Learning App

See [SPEC.md](SPEC.md) for the design.

## Local development

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your Supabase URL and anon key.
3. `npm run dev`

## Supabase setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Authentication → URL Configuration: set Site URL to the GitHub Pages URL
   (`https://cyberyeti.github.io/Japanese-Learning-App/`) and add `http://localhost:5173/**`
   and the Pages URL to the redirect allow-list.

## Deployment

Pushes to `main` build and deploy to GitHub Pages via `.github/workflows/deploy.yml`.

1. Repo Settings → Pages → Source: **GitHub Actions**.
2. Repo Settings → Secrets and variables → Actions: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
