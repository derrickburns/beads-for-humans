import type { Issue } from './issue';

export interface DurationEstimate {
	issueId: string;
	minDays: number;
	maxDays: number;
	expectedDays: number;
	confidence: number;
	reasoning: string;
	factors: string[];
}

export interface TimelineEstimate {
	estimates: Map<string, DurationEstimate>;
	criticalPath: string[];
	totalMinDays: number;
	totalMaxDays: number;
	totalExpectedDays: number;
}

export interface ScheduledTask {
	issue: Issue;
	estimate?: DurationEstimate;
	startDay: number;
	endDay: number;
	startDate: Date;
	endDate: Date;
	isOnCriticalPath: boolean;
	row: number; // For parallel task visualization
}

export interface TimelineWeek {
	weekNumber: number;
	startDate: Date;
	endDate: Date;
	tasks: ScheduledTask[];
}
