<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg';
		color?: 'primary' | 'white' | 'gray';
		label?: string;
	}

	let { size = 'md', color = 'primary', label }: Props = $props();

	const sizes = {
		sm: 'w-4 h-4 border-2',
		md: 'w-6 h-6 border-2',
		lg: 'w-8 h-8 border-3'
	};

	const colors = {
		primary: 'border-blue-200 border-t-blue-600',
		white: 'border-white/30 border-t-white',
		gray: 'border-gray-200 border-t-gray-600'
	};
</script>

<div class="inline-flex items-center gap-2" role="status" aria-label={label || 'Loading'}>
	<div class="{sizes[size]} {colors[color]} rounded-full animate-spin"></div>
	{#if label}
		<span class="text-sm text-gray-600">{label}</span>
	{/if}
</div>
