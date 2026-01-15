<script lang="ts">
	interface Props {
		text: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
		style?: 'icon' | 'underline' | 'inline';
	}

	let { text, position = 'top', style = 'icon' }: Props = $props();

	let showTooltip = $state(false);

	const positionClasses = {
		top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
		bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
		left: 'right-full top-1/2 -translate-y-1/2 mr-2',
		right: 'left-full top-1/2 -translate-y-1/2 ml-2'
	};

	const arrowClasses = {
		top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-800 border-x-transparent border-b-transparent',
		bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800 border-x-transparent border-t-transparent',
		left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-800 border-y-transparent border-r-transparent',
		right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-800 border-y-transparent border-l-transparent'
	};
</script>

<span
	class="relative inline-flex items-center"
	onmouseenter={() => (showTooltip = true)}
	onmouseleave={() => (showTooltip = false)}
	onfocus={() => (showTooltip = true)}
	onblur={() => (showTooltip = false)}
	role="button"
	tabindex="0"
	aria-describedby={showTooltip ? 'tooltip' : undefined}
>
	{#if style === 'icon'}
		<span class="inline-flex items-center justify-center w-4 h-4 text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full cursor-help hover:bg-gray-200 hover:text-gray-600 transition-colors">
			?
		</span>
	{:else if style === 'underline'}
		<span class="border-b border-dotted border-gray-400 cursor-help">
			<slot />
		</span>
	{:else}
		<span class="cursor-help">
			<slot />
		</span>
	{/if}

	{#if showTooltip}
		<div
			id="tooltip"
			role="tooltip"
			class="absolute z-50 {positionClasses[position]} w-max max-w-xs"
		>
			<div class="px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg whitespace-pre-line">
				{text}
			</div>
			<div class="absolute w-0 h-0 border-4 {arrowClasses[position]}"></div>
		</div>
	{/if}
</span>
