<script lang="ts">
	import type { PassageQuestion } from '../lib/ai/prompts';

	interface Props {
		/** A passage's comprehension question, or a lesson quiz question with an explanation. */
		question: Pick<PassageQuestion, 'q' | 'choices' | 'answer'> & { explanation?: string };
		/** Index of the chosen answer, or null until answered. One try only: in a passage it grades the grammar. */
		chosen: number | null;
		onanswer: (choice: number) => void;
		disabled?: boolean;
	}

	let { question, chosen, onanswer, disabled = false }: Props = $props();
</script>

<fieldset class="question">
	<legend>{question.q}</legend>
	{#each question.choices as choice, i (i)}
		<button
			class:correct={chosen !== null && i === question.answer}
			class:wrong={chosen === i && i !== question.answer}
			disabled={disabled || chosen !== null}
			onclick={() => onanswer(i)}>{choice}</button
		>
	{/each}
	{#if chosen !== null}
		<p class={chosen === question.answer ? 'right' : 'missed'}>
			{chosen === question.answer ? 'Correct.' : `Not quite: the answer is “${question.choices[question.answer]}”.`}
		</p>
		{#if question.explanation}
			<p class="explanation">{question.explanation}</p>
		{/if}
	{/if}
</fieldset>

<style>
	.question {
		border: 1px solid #ddd;
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		margin: 0 0 1rem;
	}
	legend {
		padding: 0 0.25rem;
	}
	button {
		display: block;
		width: 100%;
		margin: 0.4rem 0;
		padding: 0.4rem 0.6rem;
		font: inherit;
		text-align: left;
		border: 1px solid #ccc;
		border-radius: 0.35rem;
		background: #fff;
		color: inherit;
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
	}
	.correct {
		border-color: #1b7f3b;
		background: #e8f5ec;
	}
	.wrong {
		border-color: #b00020;
		background: #fbe9ec;
	}
	p {
		margin: 0.5rem 0 0;
	}
	.right {
		color: #1b7f3b;
	}
	.missed {
		color: #b00020;
	}
	.explanation {
		color: #555;
	}
</style>
