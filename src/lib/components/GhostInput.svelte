<script lang="ts">
	/**
	 * GhostInput - An input that shows a ghost suggestion when empty
	 *
	 * When the input is empty and a suggestion is available:
	 * - Shows the suggestion as faded ghost text
	 * - Tab key accepts the suggestion
	 * - Any other key clears the suggestion and types normally
	 */

	interface Props {
		value: string;
		suggestion?: string;
		placeholder?: string;
		class?: string;
		id?: string;
		autofocus?: boolean;
		onchange?: (value: string) => void;
		onblur?: () => void;
	}

	let {
		value = $bindable(''),
		suggestion = '',
		placeholder = '',
		class: className = '',
		id,
		autofocus = false,
		onchange,
		onblur
	}: Props = $props();

	let inputEl: HTMLInputElement;
	let showGhost = $derived(value === '' && suggestion !== '');

	function handleKeydown(e: KeyboardEvent) {
		if (showGhost && e.key === 'Tab' && suggestion) {
			e.preventDefault();
			value = suggestion;
			onchange?.(value);
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		onchange?.(value);
	}

	function handleBlur() {
		onblur?.();
	}
</script>

<div class="relative">
	<!-- Ghost text layer (behind the input) -->
	{#if showGhost}
		<div
			class="absolute inset-0 flex items-center px-4 py-2.5 pointer-events-none text-slate-400"
			aria-hidden="true"
		>
			{suggestion}
		</div>
	{/if}

	<!-- Actual input -->
	<input
		bind:this={inputEl}
		type="text"
		{id}
		value={value}
		oninput={handleInput}
		onkeydown={handleKeydown}
		onblur={handleBlur}
		placeholder={showGhost ? '' : placeholder}
		class="{className} {showGhost ? 'bg-transparent caret-slate-900' : ''}"
		autofocus={autofocus}
	/>

	<!-- Tab hint -->
	{#if showGhost}
		<div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
			<kbd class="px-1.5 py-0.5 text-xs bg-slate-200 text-slate-500 rounded font-mono">Tab</kbd>
		</div>
	{/if}
</div>
