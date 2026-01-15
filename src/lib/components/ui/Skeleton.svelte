<script lang="ts">
	interface Props {
		class?: string;
		width?: string;
		height?: string;
		rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
		animate?: boolean;
	}

	let {
		class: className = '',
		width = '100%',
		height = '1rem',
		rounded = 'md',
		animate = true
	}: Props = $props();

	const roundedClasses = {
		none: 'rounded-none',
		sm: 'rounded-sm',
		md: 'rounded-md',
		lg: 'rounded-lg',
		full: 'rounded-full'
	};
</script>

<div
	class="bg-gray-200 {roundedClasses[rounded]} {animate ? 'animate-pulse' : ''} {className}"
	style="width: {width}; height: {height};"
	role="status"
	aria-label="Loading"
></div>
