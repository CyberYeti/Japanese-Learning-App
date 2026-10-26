<script lang="ts">
	import { READY_SHARE, READY_STABILITY_DAYS, type Readiness } from '../lib/srs/readiness';

	let { readiness }: { readiness: Readiness } = $props();
</script>

{#if readiness.ready}
	<span class="ready">✓ Ready for the next lesson</span>
{:else}
	<span class="not-ready" title="Ready when {READY_SHARE * 100}% of the lesson's items are stable for {READY_STABILITY_DAYS}+ days">
		Not ready yet: {readiness.stable} of {readiness.total} items stable for {READY_STABILITY_DAYS}+ days ({READY_SHARE * 100}% needed)
	</span>
{/if}

<style>
	.ready {
		color: #1b7f3b;
		font-weight: 600;
	}
	.not-ready {
		color: #666;
	}
</style>
