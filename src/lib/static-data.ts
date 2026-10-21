// Loads the static JSON that ships with the site (static/data/).
import { asset } from '$app/paths';

export type StaticPath = Parameters<typeof asset>[0];

export async function staticJson<T>(path: StaticPath): Promise<T> {
	const res = await fetch(asset(path));
	if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
	return res.json();
}
