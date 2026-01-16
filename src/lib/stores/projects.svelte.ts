import { browser } from '$app/environment';
import type { DomainType } from '$lib/types/facts';

const STORAGE_KEY = 'beads-projects';
const CURRENT_PROJECT_KEY = 'beads-current-project';

export interface Project {
	id: string;
	name: string;
	description?: string;
	domain?: DomainType;
	createdAt: string;
	updatedAt: string;
	lastOpenedAt: string;
	issueCount: number;
	completedCount: number;
}

function generateId(): string {
	return crypto.randomUUID();
}

function loadProjects(): Project[] {
	if (!browser) return [];
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return [];
		return JSON.parse(stored) as Project[];
	} catch (e) {
		console.error('Failed to load projects from storage:', e);
		return [];
	}
}

function saveProjects(projects: Project[]): void {
	if (browser) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
	}
}

function loadCurrentProjectId(): string | null {
	if (!browser) return null;
	return localStorage.getItem(CURRENT_PROJECT_KEY);
}

function saveCurrentProjectId(projectId: string | null): void {
	if (browser) {
		if (projectId) {
			localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
		} else {
			localStorage.removeItem(CURRENT_PROJECT_KEY);
		}
	}
}

class ProjectStore {
	projects = $state<Project[]>(loadProjects());
	currentProjectId = $state<string | null>(loadCurrentProjectId());

	// Get the current project
	get current(): Project | null {
		if (!this.currentProjectId) return null;
		return this.projects.find(p => p.id === this.currentProjectId) || null;
	}

	// Get projects sorted by last opened
	get recentProjects(): Project[] {
		return [...this.projects].sort((a, b) =>
			new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
		);
	}

	// Check if we have any projects
	get hasProjects(): boolean {
		return this.projects.length > 0;
	}

	// Create a new project
	create(data: {
		name: string;
		description?: string;
		domain?: DomainType;
	}): Project {
		const now = new Date().toISOString();
		const project: Project = {
			id: generateId(),
			name: data.name,
			description: data.description,
			domain: data.domain,
			createdAt: now,
			updatedAt: now,
			lastOpenedAt: now,
			issueCount: 0,
			completedCount: 0
		};

		this.projects = [...this.projects, project];
		saveProjects(this.projects);

		return project;
	}

	// Open/select a project
	open(projectId: string): Project | null {
		const project = this.projects.find(p => p.id === projectId);
		if (!project) return null;

		// Update last opened time
		const now = new Date().toISOString();
		this.projects = this.projects.map(p =>
			p.id === projectId ? { ...p, lastOpenedAt: now } : p
		);
		saveProjects(this.projects);

		// Set as current project
		this.currentProjectId = projectId;
		saveCurrentProjectId(projectId);

		return project;
	}

	// Close current project (go back to project picker)
	close(): void {
		this.currentProjectId = null;
		saveCurrentProjectId(null);
	}

	// Update project metadata
	update(projectId: string, data: Partial<Pick<Project, 'name' | 'description' | 'domain'>>): Project | null {
		const index = this.projects.findIndex(p => p.id === projectId);
		if (index === -1) return null;

		const now = new Date().toISOString();
		const updated: Project = {
			...this.projects[index],
			...data,
			updatedAt: now
		};

		this.projects = [
			...this.projects.slice(0, index),
			updated,
			...this.projects.slice(index + 1)
		];
		saveProjects(this.projects);

		return updated;
	}

	// Update issue counts (called by issue store)
	updateCounts(projectId: string, issueCount: number, completedCount: number): void {
		const index = this.projects.findIndex(p => p.id === projectId);
		if (index === -1) return;

		this.projects = this.projects.map(p =>
			p.id === projectId ? { ...p, issueCount, completedCount, updatedAt: new Date().toISOString() } : p
		);
		saveProjects(this.projects);
	}

	// Delete a project
	delete(projectId: string): boolean {
		const index = this.projects.findIndex(p => p.id === projectId);
		if (index === -1) return false;

		this.projects = this.projects.filter(p => p.id !== projectId);
		saveProjects(this.projects);

		// Clear localStorage for this project's issues
		if (browser) {
			localStorage.removeItem(`issues-${projectId}`);
			localStorage.removeItem(`facts-${projectId}`);
		}

		// If deleting current project, clear selection
		if (this.currentProjectId === projectId) {
			this.currentProjectId = null;
			saveCurrentProjectId(null);
		}

		return true;
	}

	// Migrate from old single-project format to multi-project
	migrateFromLegacy(): Project | null {
		if (!browser) return null;

		// Check if there are legacy issues (old format)
		const legacyIssues = localStorage.getItem('issues');
		if (!legacyIssues) return null;

		try {
			const issues = JSON.parse(legacyIssues);
			if (!Array.isArray(issues) || issues.length === 0) return null;

			// Create a project for the legacy data
			const project = this.create({
				name: 'My Project',
				description: 'Migrated from previous session'
			});

			// Move legacy issues to project-specific storage
			localStorage.setItem(`issues-${project.id}`, legacyIssues);
			localStorage.removeItem('issues');

			// Update counts
			const completedCount = issues.filter((i: { status: string }) => i.status === 'closed').length;
			this.updateCounts(project.id, issues.length, completedCount);

			// Open the migrated project
			this.open(project.id);

			return project;
		} catch (e) {
			console.error('Failed to migrate legacy data:', e);
			return null;
		}
	}
}

export const projectStore = new ProjectStore();
