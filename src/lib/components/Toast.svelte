<script lang="ts">
	import { browser } from '$app/environment';

	interface Props {
		message: string;
		action?: { label: string; href: string };
		duration?: number;
		onClose: () => void;
	}

	let { message, action, duration = 4000, onClose }: Props = $props();

	// Auto-dismiss after duration
	$effect(() => {
		if (browser) {
			const timer = setTimeout(onClose, duration);
			return () => clearTimeout(timer);
		}
	});
</script>

<div class="fixed bottom-6 right-6 z-50 animate-slide-up">
	<div class="flex items-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-lg shadow-lg">
		<span class="text-sm">{message}</span>
		{#if action}
			<a
				href={action.href}
				class="text-sm font-medium text-blue-400 hover:text-blue-300 whitespace-nowrap"
			>
				{action.label}
			</a>
		{/if}
		<button
			onclick={onClose}
			class="p-1 hover:bg-gray-700 rounded transition-colors"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>
</div>

<style>
	@keyframes slide-up {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
	.animate-slide-up {
		animation: slide-up 0.3s ease-out;
	}
</style>
