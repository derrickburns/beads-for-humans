<script lang="ts">
	interface Props {
		title?: string;
		message: string;
		type?: 'error' | 'warning' | 'info';
		dismissible?: boolean;
		onDismiss?: () => void;
		retry?: () => void;
	}

	let {
		title,
		message,
		type = 'error',
		dismissible = false,
		onDismiss,
		retry
	}: Props = $props();

	const styles = {
		error: {
			bg: 'bg-red-50',
			border: 'border-red-200',
			icon: 'text-red-500',
			title: 'text-red-900',
			message: 'text-red-700',
			button: 'text-red-600 hover:bg-red-100'
		},
		warning: {
			bg: 'bg-amber-50',
			border: 'border-amber-200',
			icon: 'text-amber-500',
			title: 'text-amber-900',
			message: 'text-amber-700',
			button: 'text-amber-600 hover:bg-amber-100'
		},
		info: {
			bg: 'bg-blue-50',
			border: 'border-blue-200',
			icon: 'text-blue-500',
			title: 'text-blue-900',
			message: 'text-blue-700',
			button: 'text-blue-600 hover:bg-blue-100'
		}
	};

	const icons = {
		error: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`,
		warning: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />`,
		info: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`
	};

	const s = styles[type];

	// Convert technical errors to user-friendly messages
	function humanizeError(msg: string): string {
		if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
			return 'Unable to connect. Please check your internet connection and try again.';
		}
		if (msg.includes('401') || msg.includes('Unauthorized')) {
			return 'Your session has expired. Please sign in again.';
		}
		if (msg.includes('403') || msg.includes('Forbidden')) {
			return 'You don\'t have permission to do that.';
		}
		if (msg.includes('404') || msg.includes('Not Found')) {
			return 'The requested item could not be found.';
		}
		if (msg.includes('500') || msg.includes('Internal Server')) {
			return 'Something went wrong on our end. Please try again later.';
		}
		if (msg.includes('timeout') || msg.includes('Timeout')) {
			return 'The request took too long. Please try again.';
		}
		if (msg.includes('API key') || msg.includes('api_key')) {
			return 'AI features require an API key. Please configure your settings.';
		}
		return msg;
	}
</script>

<div class="p-4 {s.bg} border {s.border} rounded-xl flex items-start gap-3" role="alert">
	<!-- Icon -->
	<div class="flex-shrink-0 mt-0.5">
		<svg class="w-5 h-5 {s.icon}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			{@html icons[type]}
		</svg>
	</div>

	<!-- Content -->
	<div class="flex-1 min-w-0">
		{#if title}
			<h4 class="font-medium {s.title}">{title}</h4>
		{/if}
		<p class="{s.message} {title ? 'text-sm mt-1' : ''}">{humanizeError(message)}</p>

		<!-- Actions -->
		{#if retry}
			<button
				onclick={retry}
				class="mt-3 px-3 py-1.5 text-sm font-medium {s.button} rounded-lg transition-colors"
			>
				Try Again
			</button>
		{/if}
	</div>

	<!-- Dismiss button -->
	{#if dismissible && onDismiss}
		<button
			onclick={onDismiss}
			class="flex-shrink-0 p-1 {s.button} rounded-lg transition-colors"
			aria-label="Dismiss"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	{/if}
</div>
