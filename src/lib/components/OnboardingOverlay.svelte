<script lang="ts">
	import { onboardingStore, onboardingSteps } from '$lib/stores/onboarding.svelte';
	import { goto } from '$app/navigation';

	function handleAction() {
		// Special handling for the last step
		if (onboardingStore.isLastStep) {
			onboardingStore.complete();
			goto('/plan');
		} else {
			onboardingStore.nextStep();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onboardingStore.dismiss();
		} else if (e.key === 'ArrowRight' || e.key === 'Enter') {
			handleAction();
		} else if (e.key === 'ArrowLeft') {
			onboardingStore.prevStep();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if onboardingStore.isShowing}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
		onclick={() => onboardingStore.dismiss()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="onboarding-title"
	>
		<!-- Modal -->
		<div
			class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Progress bar -->
			<div class="h-1 bg-gray-100">
				<div
					class="h-full bg-blue-600 transition-all duration-300"
					style="width: {onboardingStore.progress}%"
				></div>
			</div>

			<!-- Content -->
			<div class="p-8">
				<!-- Step indicator -->
				<div class="flex items-center justify-center gap-2 mb-6">
					{#each onboardingSteps as _, i}
						<div
							class="w-2 h-2 rounded-full transition-colors {i === onboardingStore.currentStep
								? 'bg-blue-600'
								: i < onboardingStore.currentStep
									? 'bg-blue-300'
									: 'bg-gray-200'}"
						></div>
					{/each}
				</div>

				<!-- Icon -->
				<div class="flex justify-center mb-6">
					{#if onboardingStore.step.id === 'welcome'}
						<div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
							<svg class="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
						</div>
					{:else if onboardingStore.step.id === 'create-task'}
						<div class="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center">
							<svg class="w-10 h-10 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
							</svg>
						</div>
					{:else if onboardingStore.step.id === 'understand-status'}
						<div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
							<svg class="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
							</svg>
						</div>
					{:else if onboardingStore.step.id === 'ai-suggestions'}
						<div class="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
							<svg class="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
							</svg>
						</div>
					{:else}
						<div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
							<svg class="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
						</div>
					{/if}
				</div>

				<!-- Title -->
				<h2 id="onboarding-title" class="text-2xl font-bold text-gray-900 text-center mb-4">
					{onboardingStore.step.title}
				</h2>

				<!-- Description -->
				<div class="text-gray-600 text-center mb-8 whitespace-pre-line leading-relaxed">
					{@html onboardingStore.step.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-between">
					<div>
						{#if onboardingStore.currentStep > 0}
							<button
								onclick={() => onboardingStore.prevStep()}
								class="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
							>
								← Back
							</button>
						{:else}
							<button
								onclick={() => onboardingStore.dismiss()}
								class="px-4 py-2 text-gray-400 hover:text-gray-600 text-sm transition-colors"
							>
								Skip tutorial
							</button>
						{/if}
					</div>

					<button
						onclick={handleAction}
						class="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
					>
						{onboardingStore.step.action || 'Next'}
						{#if !onboardingStore.isLastStep}
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
						{/if}
					</button>
				</div>
			</div>

			<!-- Footer hint -->
			<div class="px-8 py-3 bg-gray-50 border-t border-gray-100 text-center">
				<p class="text-xs text-gray-400">
					Use arrow keys to navigate · Press Esc to skip
				</p>
			</div>
		</div>
	</div>
{/if}
