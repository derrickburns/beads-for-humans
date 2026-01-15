import { browser } from '$app/environment';

const STORAGE_KEY = 'onboarding-completed';

export interface OnboardingStep {
	id: string;
	title: string;
	description: string;
	action?: string; // What the user should do
	highlight?: string; // CSS selector to highlight
}

export const onboardingSteps: OnboardingStep[] = [
	{
		id: 'welcome',
		title: 'Welcome to Middle Manager',
		description: 'I\'m your AI planning assistant. I\'ll help you break down complex projects into manageable tasks - no project management experience needed.',
		action: 'Let\'s take a quick tour'
	},
	{
		id: 'create-task',
		title: 'Start with a Goal',
		description: 'Click "Plan Project" to describe what you want to accomplish. I\'ll help break it down into steps, or you can add tasks one at a time.',
		action: 'Try the Plan Project button',
		highlight: '[data-onboarding="plan-button"]'
	},
	{
		id: 'understand-status',
		title: 'Know What You Can Work On',
		description: 'Tasks are color-coded:\n\n🟢 **Green** = Can start now\n🟡 **Amber** = Waiting on something else\n🔵 **Blue** = In progress\n⚫ **Gray** = Done\n\nFocus on green tasks first!',
		action: 'Got it'
	},
	{
		id: 'ai-suggestions',
		title: 'AI Does the Heavy Lifting',
		description: 'When you select a task, I\'ll suggest what needs to be done first. Look for the purple "AI" badges - those are my suggestions.\n\nI\'ll also tell you which tasks YOU need to do vs which I can help with.',
		action: 'Sounds great'
	},
	{
		id: 'get-started',
		title: 'You\'re Ready!',
		description: 'Start by telling me your project goal. I\'ll create a complete plan with:\n\n✓ All the tasks you need\n✓ What order to do them\n✓ Which ones need expert review\n✓ Risks to watch out for',
		action: 'Let\'s Plan!'
	}
];

class OnboardingStore {
	// Whether onboarding has been completed
	completed = $state(false);
	// Whether onboarding is currently showing
	isShowing = $state(false);
	// Current step index
	currentStep = $state(0);

	constructor() {
		if (browser) {
			this.completed = localStorage.getItem(STORAGE_KEY) === 'true';
			// Auto-show on first visit
			if (!this.completed) {
				this.isShowing = true;
			}
		}
	}

	get step(): OnboardingStep {
		return onboardingSteps[this.currentStep];
	}

	get isLastStep(): boolean {
		return this.currentStep === onboardingSteps.length - 1;
	}

	get progress(): number {
		return ((this.currentStep + 1) / onboardingSteps.length) * 100;
	}

	nextStep() {
		if (this.currentStep < onboardingSteps.length - 1) {
			this.currentStep++;
		} else {
			this.complete();
		}
	}

	prevStep() {
		if (this.currentStep > 0) {
			this.currentStep--;
		}
	}

	complete() {
		this.completed = true;
		this.isShowing = false;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, 'true');
		}
	}

	dismiss() {
		this.isShowing = false;
		// Don't mark as completed - they can restart it
	}

	restart() {
		this.currentStep = 0;
		this.isShowing = true;
	}

	// For testing/demo purposes
	reset() {
		this.completed = false;
		this.currentStep = 0;
		this.isShowing = true;
		if (browser) {
			localStorage.removeItem(STORAGE_KEY);
		}
	}
}

export const onboardingStore = new OnboardingStore();
