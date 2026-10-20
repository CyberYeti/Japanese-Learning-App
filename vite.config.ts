import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter({ fallback: '404.html' }),
			paths: {
				// Set to "/Japanese-Learning-App" by the GitHub Pages workflow; empty for local dev.
				base: (process.env.BASE_PATH ?? '') as '' | `/${string}`
			}
		})
	],
	test: { include: ['src/**/*.test.ts'] }
});
