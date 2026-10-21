<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>About · Japanese Learning App</title></svelte:head>

<main>
	<p><a href={resolve('/')}>← Home</a></p>
	<h1>About and credits</h1>
	<p>
		A personal app for learning Japanese through graded reading. It builds on the work below; each is used under its
		own licence, separate from the app's code.
	</p>

	<dl>
		<dt>Lessons</dt>
		<dd>
			<a href="https://guidetojapanese.org/learn/grammar">Tae Kim's Guide to Learning Japanese</a> by Tae Kim, licensed
			<a href="https://creativecommons.org/licenses/by-nc-sa/3.0/us/">CC BY-NC-SA 3.0 US</a>. The lessons were
			imported with navigation, videos and exercises removed; the adapted lesson data is shared under the same licence.
		</dd>

		<dt>Dictionary</dt>
		<dd>
			<a href="https://www.edrdg.org/jmdict/j_jmdict.html">JMdict</a>, the property of the
			<a href="https://www.edrdg.org/">Electronic Dictionary Research and Development Group</a>, used in conformance
			with the Group's <a href="https://www.edrdg.org/edrdg/licence.html">licence</a>
			(<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>), via
			<a href="https://github.com/scriptin/jmdict-simplified">jmdict-simplified</a>.
		</dd>

		<dt>Tokenizer</dt>
		<dd>
			<a href="https://github.com/takuyaa/kuromoji.js">kuromoji.js</a> (Apache 2.0) with the IPADIC dictionary.
		</dd>

		<dt>Spaced repetition</dt>
		<dd><a href="https://github.com/open-spaced-repetition/ts-fsrs">ts-fsrs</a> (MIT).</dd>

		<dt>JLPT word lists</dt>
		<dd>
			<a href="https://github.com/stephenmk/yomitan-jlpt-vocab">stephenmk/yomitan-jlpt-vocab</a>
			(<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>), based on Jonathan Waller's JLPT
			Resources at <a href="http://www.tanos.co.uk/jlpt/">tanos.co.uk</a> (CC BY).
		</dd>
	</dl>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
		line-height: 1.6;
	}
	dt {
		font-weight: 600;
		margin-top: 1rem;
	}
	dd {
		margin-left: 0;
	}
</style>
