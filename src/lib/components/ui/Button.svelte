<script lang="ts">
	import type { Snippet } from 'svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		href?: string;
		class?: string;
		children: Snippet;
		onclick?: (e: MouseEvent) => void;
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		disabled = false,
		type = 'button',
		href,
		class: className = '',
		children,
		onclick
	}: Props = $props();

	const variants = {
		primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm',
		secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500',
		ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500',
		danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm'
	};

	const sizes = {
		sm: 'px-3 py-1.5 text-sm gap-1.5',
		md: 'px-4 py-2 text-sm gap-2',
		lg: 'px-6 py-3 text-base gap-2'
	};

	const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
</script>

{#if href && !disabled && !loading}
	<a
		{href}
		class="{baseStyles} {variants[variant]} {sizes[size]} {className}"
	>
		{@render children()}
	</a>
{:else}
	<button
		{type}
		{onclick}
		disabled={disabled || loading}
		class="{baseStyles} {variants[variant]} {sizes[size]} {className}"
	>
		{#if loading}
			<LoadingSpinner size="sm" color={variant === 'primary' || variant === 'danger' ? 'white' : 'gray'} />
		{/if}
		{@render children()}
	</button>
{/if}
