// Builds the app's static vocab and dictionary data. Run after scripts/import_taekim.py:
//   npm run data:build
// 1. Tokenizes each lesson's example sentences with the app's kuromoji dictionary and writes the
//    lesson's content-word keys back into static/data/lessons/{id}.json as `words`.
// 2. Writes static/data/vocab/n5.json (the N5 list, merged with lesson words by vocab key) and
//    static/data/vocab/lessons.json (lesson words on no JLPT list).
// 3. Rewrites static/data/dict/ as jmdict-eng-common shards keyed by headword first character.
// Downloads are cached in .cache/ (gitignored). Sources and licenses: static/data/*/LICENSE.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { contentWords } from '../src/lib/nlp/content';
import { loadNodeTokenizer } from '../src/lib/nlp/node-tokenizer';
import { createDictIndex, shardDictionary, trimEntry, type JmdictWord } from './build/dict';
import { mergeVocab, parseJlptCsv } from './build/vocab';

const JMDICT_VERSION = '3.6.2+20261019180022';
const JMDICT_URL = `https://github.com/scriptin/jmdict-simplified/releases/download/${encodeURIComponent(JMDICT_VERSION)}/jmdict-eng-common-${encodeURIComponent(JMDICT_VERSION)}.json.tgz`;
// Pinned commit of stephenmk/yomitan-jlpt-vocab (CC BY-SA 4.0, from Jonathan Waller's JLPT lists).
const N5_URL =
	'https://raw.githubusercontent.com/stephenmk/yomitan-jlpt-vocab/b062d4e38c4bdd0950ae1d4ec55f04b176182e03/original_data/n5.csv';

const ROOT = join(import.meta.dirname, '..');
const CACHE = join(ROOT, '.cache');
const DATA = join(ROOT, 'static', 'data');

interface Lesson {
	id: string;
	examples: { ja: string; en: string }[];
	words?: string[];
}

async function download(url: string, file: string): Promise<string> {
	const path = join(CACHE, file);
	if (!existsSync(path)) {
		console.log(`Downloading ${url}`);
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${url}: ${res.status}`);
		await mkdir(CACHE, { recursive: true });
		await writeFile(path, Buffer.from(await res.arrayBuffer()));
	}
	return path;
}

async function loadJmdict(): Promise<JmdictWord[]> {
	const archive = `jmdict-eng-common-${JMDICT_VERSION}.json.tgz`;
	// The archive's file name leaves off the +date build suffix.
	const json = `jmdict-eng-common-${JMDICT_VERSION.split('+')[0]}.json`;
	await download(JMDICT_URL, archive);
	// Relative paths: GNU tar (e.g. Git Bash) reads "C:\..." as a remote host.
	if (!existsSync(join(CACHE, json))) execFileSync('tar', ['-xzf', archive], { cwd: CACHE });
	return JSON.parse(await readFile(join(CACHE, json), 'utf8')).words;
}

const writeJson = (path: string, data: unknown) => writeFile(path, JSON.stringify(data, null, '\t') + '\n');

async function main() {
	const lessonDir = join(DATA, 'lessons');
	const index: { id: string }[] = JSON.parse(await readFile(join(lessonDir, 'index.json'), 'utf8'));
	if (!index.length) throw new Error('No lessons found; run scripts/import_taekim.py first.');

	const tokenizer = await loadNodeTokenizer();
	const lessons = [];
	for (const { id } of index) {
		const path = join(lessonDir, `${id}.json`);
		const lesson: Lesson = JSON.parse(await readFile(path, 'utf8'));
		const words = contentWords(tokenizer, lesson.examples.map((e) => e.ja).join('\n'));
		await writeJson(path, { ...lesson, words: words.map((w) => w.key) });
		lessons.push({ id, words });
	}
	console.log(`Lessons: ${lessons.reduce((n, l) => n + l.words.length, 0)} lesson words`);

	const jmdict = await loadJmdict();
	const n5 = parseJlptCsv(await readFile(await download(N5_URL, 'n5.csv'), 'utf8'), 5);
	const vocab = mergeVocab(n5, lessons, createDictIndex(jmdict));
	const vocabDir = join(DATA, 'vocab');
	await mkdir(vocabDir, { recursive: true });
	await writeJson(join(vocabDir, 'n5.json'), vocab.filter((w) => w.jlpt === 5));
	await writeJson(join(vocabDir, 'lessons.json'), vocab.filter((w) => w.jlpt === null));
	console.log(`Vocab: ${n5.length} N5 words, ${vocab.length - n5.length} lesson-only words`);

	const dictDir = join(DATA, 'dict');
	for (const file of await readdir(dictDir).catch(() => [])) {
		if (file.endsWith('.json')) await rm(join(dictDir, file));
	}
	await mkdir(dictDir, { recursive: true });
	const entries = jmdict.map(trimEntry);
	const shards = shardDictionary(entries);
	for (const [key, shard] of shards) await writeFile(join(dictDir, `${key}.json`), JSON.stringify(shard));
	console.log(`Dictionary: ${entries.length} entries in ${shards.size} shards`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
