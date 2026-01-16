<script lang="ts">
	/**
	 * AITextarea - A textarea with AI-powered autocomplete
	 *
	 * Like GitHub Copilot:
	 * - Pauses after typing trigger autocomplete
	 * - Shows ghost text suggestion after cursor
	 * - Tab accepts the suggestion
	 * - Any other key dismisses it
	 */
	import { aiSettings } from '$lib/stores/aiSettings.svelte';

	interface Props {
		value: string;
		placeholder?: string;
		rows?: number;
		class?: string;
		id?: string;
		autofocus?: boolean;
		context?: string; // Additional context for AI (e.g., project domain, parent task)
		onchange?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		placeholder = '',
		rows = 3,
		class: className = '',
		id,
		autofocus = false,
		context = '',
		onchange
	}: Props = $props();

	let textareaEl: HTMLTextAreaElement;
	let suggestion = $state('');
	let isLoading = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Debounce delay before fetching suggestion (ms)
	const DEBOUNCE_DELAY = 800;

	async function fetchSuggestion() {
		if (!value.trim() || !aiSettings.apiKey) {
			suggestion = '';
			return;
		}

		isLoading = true;
		try {
			const response = await fetch('/api/autocomplete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: value,
					context,
					model: aiSettings.model,
					apiKey: aiSettings.apiKey
				})
			});

			if (response.ok) {
				const data = await response.json();
				// Only show suggestion if text hasn't changed
				if (data.suggestion) {
					suggestion = data.suggestion;
				}
			}
		} catch (e) {
			console.error('Autocomplete error:', e);
		} finally {
			isLoading = false;
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		value = target.value;
		suggestion = ''; // Clear suggestion on input
		onchange?.(value);

		// Debounce autocomplete request
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(fetchSuggestion, DEBOUNCE_DELAY);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (suggestion && e.key === 'Tab') {
			e.preventDefault();
			value = value + suggestion;
			suggestion = '';
			onchange?.(value);
			// Move cursor to end
			if (textareaEl) {
				textareaEl.selectionStart = textareaEl.selectionEnd = value.length;
			}
		} else if (suggestion && e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') {
			// Any other key (except modifiers) clears suggestion
			// The actual input will be handled by the input event
			suggestion = '';
		}
	}

	function handleBlur() {
		// Clear suggestion on blur after a short delay (allows Tab to work)
		setTimeout(() => {
			suggestion = '';
		}, 100);
	}

	// Cleanup timer on unmount
	$effect(() => {
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});
</script>

<div class="relative">
	<!-- Textarea with ghost text overlay -->
	<div class="relative">
		<!-- Ghost suggestion overlay -->
		{#if suggestion}
			<div
				class="absolute inset-0 pointer-events-none overflow-hidden"
				aria-hidden="true"
			>
				<div class="px-4 py-2.5 whitespace-pre-wrap break-words" style="font: inherit; line-height: inherit;">
					<span class="invisible">{value}</span><span class="text-slate-400">{suggestion}</span>
				</div>
			</div>
		{/if}

		<!-- Actual textarea -->
		<textarea
			bind:this={textareaEl}
			{id}
			{rows}
			value={value}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onblur={handleBlur}
			{placeholder}
			class="{className} {suggestion ? 'bg-transparent' : ''}"
			autofocus={autofocus}
		></textarea>
	</div>

	<!-- Tab hint and loading indicator -->
	{#if suggestion || isLoading}
		<div class="absolute right-2 bottom-2 flex items-center gap-2">
			{#if isLoading}
				<span class="text-xs text-slate-400">thinking...</span>
			{:else if suggestion}
				<kbd class="px-1.5 py-0.5 text-xs bg-slate-200 text-slate-500 rounded font-mono">Tab</kbd>
			{/if}
		</div>
	{/if}
</div>
