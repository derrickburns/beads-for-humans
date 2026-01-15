import type { IssueType, IssuePriority, ExecutionType } from '$lib/types/issue';

export interface TemplateTask {
	title: string;
	description: string;
	type: IssueType;
	priority: IssuePriority;
	executionType: ExecutionType;
	validationRequired?: boolean;
	expertNeeded?: string;
	dependsOnIndex?: number[]; // Indices of tasks this depends on
	category: string;
}

export interface ProjectTemplate {
	id: string;
	name: string;
	description: string;
	icon: string; // Emoji or SVG path
	category: string;
	estimatedDuration: string;
	tasks: TemplateTask[];
	tips: string[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
	{
		id: 'sell-house',
		name: 'Selling a House',
		description: 'Complete guide from preparation to closing day',
		icon: '🏠',
		category: 'Real Estate',
		estimatedDuration: '2-6 months',
		tasks: [
			{
				title: 'Research local market conditions',
				description: 'Understand current home prices, days on market, and buyer demand in your area',
				type: 'task',
				priority: 1,
				executionType: 'ai_assisted',
				category: 'research'
			},
			{
				title: 'Interview and select a real estate agent',
				description: 'Meet with 3+ agents, compare commission rates, marketing plans, and track records',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				category: 'decision'
			},
			{
				title: 'Get professional home inspection',
				description: 'Identify issues before buyers do - gives you negotiating power',
				type: 'task',
				priority: 2,
				executionType: 'human',
				validationRequired: true,
				expertNeeded: 'Licensed Home Inspector',
				dependsOnIndex: [1],
				category: 'inspection'
			},
			{
				title: 'Make necessary repairs',
				description: 'Fix issues found in inspection that could derail the sale',
				type: 'task',
				priority: 2,
				executionType: 'human_assisted',
				dependsOnIndex: [2],
				category: 'preparation'
			},
			{
				title: 'Stage and photograph home',
				description: 'Professional photos dramatically increase buyer interest',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [3],
				category: 'marketing'
			},
			{
				title: 'Set listing price',
				description: 'Price based on comps, condition, and market conditions',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [0, 1],
				category: 'decision'
			},
			{
				title: 'List property and begin showings',
				description: 'Go live on MLS and schedule open houses',
				type: 'task',
				priority: 1,
				executionType: 'human',
				dependsOnIndex: [4, 5],
				category: 'marketing'
			},
			{
				title: 'Review and negotiate offers',
				description: 'Evaluate offers, counter-offer strategically',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [6],
				category: 'negotiation'
			},
			{
				title: 'Accept offer and open escrow',
				description: 'Sign purchase agreement and begin closing process',
				type: 'task',
				priority: 1,
				executionType: 'human',
				validationRequired: true,
				expertNeeded: 'Real Estate Attorney',
				dependsOnIndex: [7],
				category: 'legal'
			},
			{
				title: 'Complete closing and hand over keys',
				description: 'Sign final documents, transfer title, receive funds',
				type: 'task',
				priority: 0,
				executionType: 'human',
				dependsOnIndex: [8],
				category: 'closing'
			}
		],
		tips: [
			'Start 2-3 months before you want to list to allow time for repairs',
			'Declutter aggressively - buyers need to imagine their stuff in the space',
			'Price competitively from the start - overpriced homes sit longer'
		]
	},
	{
		id: 'kitchen-remodel',
		name: 'Kitchen Remodel',
		description: 'From design to finished kitchen',
		icon: '🍳',
		category: 'Home Improvement',
		estimatedDuration: '3-6 months',
		tasks: [
			{
				title: 'Define scope and budget',
				description: 'Determine what you want to change and how much you can spend',
				type: 'task',
				priority: 0,
				executionType: 'human_assisted',
				category: 'planning'
			},
			{
				title: 'Research and select designer or contractor',
				description: 'Get 3+ quotes, check references, verify licenses',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [0],
				category: 'vendor'
			},
			{
				title: 'Create design and floor plan',
				description: 'Work with designer to finalize layout, materials, and appliances',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [1],
				category: 'design'
			},
			{
				title: 'Obtain necessary permits',
				description: 'Get building permits for structural, electrical, and plumbing work',
				type: 'task',
				priority: 1,
				executionType: 'human',
				validationRequired: true,
				expertNeeded: 'Licensed Contractor',
				dependsOnIndex: [2],
				category: 'legal'
			},
			{
				title: 'Order materials and appliances',
				description: 'Order cabinets, countertops, appliances with lead times in mind',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [2],
				category: 'procurement'
			},
			{
				title: 'Set up temporary kitchen',
				description: 'Prepare alternative cooking/washing arrangements during construction',
				type: 'task',
				priority: 2,
				executionType: 'human',
				dependsOnIndex: [3],
				category: 'preparation'
			},
			{
				title: 'Demolition and construction',
				description: 'Remove old kitchen and complete structural changes',
				type: 'task',
				priority: 1,
				executionType: 'human',
				dependsOnIndex: [3, 5],
				category: 'construction'
			},
			{
				title: 'Install electrical and plumbing',
				description: 'Complete rough-in for new layout before closing walls',
				type: 'task',
				priority: 1,
				executionType: 'human',
				validationRequired: true,
				expertNeeded: 'Licensed Electrician/Plumber',
				dependsOnIndex: [6],
				category: 'construction'
			},
			{
				title: 'Install cabinets and countertops',
				description: 'Careful installation of cabinetry and counter surfaces',
				type: 'task',
				priority: 1,
				executionType: 'human',
				dependsOnIndex: [4, 7],
				category: 'installation'
			},
			{
				title: 'Final inspection and punch list',
				description: 'Get final inspection approval and address any remaining issues',
				type: 'task',
				priority: 0,
				executionType: 'human',
				validationRequired: true,
				expertNeeded: 'Building Inspector',
				dependsOnIndex: [8],
				category: 'inspection'
			}
		],
		tips: [
			'Add 20% buffer to your budget for unexpected issues',
			'Order appliances early - delivery times can be 6-8 weeks',
			'Keep detailed records of all decisions for warranty purposes'
		]
	},
	{
		id: 'wedding-planning',
		name: 'Wedding Planning',
		description: 'Organize your perfect day',
		icon: '💒',
		category: 'Life Events',
		estimatedDuration: '6-12 months',
		tasks: [
			{
				title: 'Set budget and priorities',
				description: 'Determine total budget and what matters most to you as a couple',
				type: 'task',
				priority: 0,
				executionType: 'human',
				category: 'planning'
			},
			{
				title: 'Create guest list',
				description: 'Compile initial guest list to help choose venue size',
				type: 'task',
				priority: 1,
				executionType: 'human',
				dependsOnIndex: [0],
				category: 'planning'
			},
			{
				title: 'Book venue and set date',
				description: 'Secure ceremony and reception locations',
				type: 'task',
				priority: 0,
				executionType: 'human_assisted',
				dependsOnIndex: [1],
				category: 'vendor'
			},
			{
				title: 'Hire photographer and videographer',
				description: 'Book professionals whose style matches your vision',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [2],
				category: 'vendor'
			},
			{
				title: 'Select and book caterer',
				description: 'Schedule tastings and finalize menu',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [2],
				category: 'vendor'
			},
			{
				title: 'Send save-the-dates',
				description: 'Give guests advance notice, especially for destination weddings',
				type: 'task',
				priority: 2,
				executionType: 'human_assisted',
				dependsOnIndex: [2],
				category: 'communication'
			},
			{
				title: 'Choose wedding party attire',
				description: 'Select wedding dress, suits, and bridesmaid/groomsmen outfits',
				type: 'task',
				priority: 2,
				executionType: 'human',
				dependsOnIndex: [2],
				category: 'preparation'
			},
			{
				title: 'Send invitations and track RSVPs',
				description: 'Mail formal invitations 6-8 weeks before the wedding',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [5],
				category: 'communication'
			},
			{
				title: 'Finalize details with vendors',
				description: 'Confirm timeline, meals, setup requirements with all vendors',
				type: 'task',
				priority: 1,
				executionType: 'human',
				dependsOnIndex: [7],
				category: 'coordination'
			},
			{
				title: 'Wedding rehearsal and dinner',
				description: 'Practice ceremony and celebrate with wedding party',
				type: 'task',
				priority: 1,
				executionType: 'human',
				dependsOnIndex: [8],
				category: 'event'
			}
		],
		tips: [
			'Book popular vendors 9-12 months in advance',
			'Consider hiring a day-of coordinator even if you plan yourself',
			'Build in buffer time for the day - things always take longer than expected'
		]
	},
	{
		id: 'retirement-planning',
		name: 'Retirement Planning',
		description: 'Prepare for financial independence',
		icon: '🏖️',
		category: 'Financial',
		estimatedDuration: 'Ongoing',
		tasks: [
			{
				title: 'Calculate retirement needs',
				description: 'Estimate living expenses, healthcare costs, and desired lifestyle',
				type: 'task',
				priority: 0,
				executionType: 'ai_assisted',
				category: 'analysis'
			},
			{
				title: 'Review current financial position',
				description: 'Inventory all assets, debts, and current savings rate',
				type: 'task',
				priority: 1,
				executionType: 'ai_assisted',
				category: 'analysis'
			},
			{
				title: 'Consult with financial advisor',
				description: 'Get professional input on retirement strategy',
				type: 'task',
				priority: 1,
				executionType: 'human',
				validationRequired: true,
				expertNeeded: 'Certified Financial Planner (CFP)',
				dependsOnIndex: [0, 1],
				category: 'consultation'
			},
			{
				title: 'Maximize retirement account contributions',
				description: 'Increase 401(k), IRA, and other retirement account contributions',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [2],
				category: 'action'
			},
			{
				title: 'Review and optimize investment allocation',
				description: 'Ensure portfolio matches risk tolerance and timeline',
				type: 'task',
				priority: 2,
				executionType: 'ai_assisted',
				dependsOnIndex: [2],
				category: 'optimization'
			},
			{
				title: 'Plan for healthcare coverage',
				description: 'Understand Medicare options and potential gaps before 65',
				type: 'task',
				priority: 2,
				executionType: 'ai_assisted',
				category: 'planning'
			},
			{
				title: 'Review Social Security strategy',
				description: 'Determine optimal claiming age based on your situation',
				type: 'task',
				priority: 2,
				executionType: 'ai_assisted',
				category: 'planning'
			},
			{
				title: 'Update estate planning documents',
				description: 'Review will, trusts, beneficiaries, and power of attorney',
				type: 'task',
				priority: 2,
				executionType: 'human',
				validationRequired: true,
				expertNeeded: 'Estate Planning Attorney',
				category: 'legal'
			}
		],
		tips: [
			'Start as early as possible - compound interest is powerful',
			'Dont forget to account for inflation in your calculations',
			'Consider working part-time in early retirement for income and purpose'
		]
	},
	{
		id: 'college-application',
		name: 'College Application',
		description: 'Navigate the college admissions process',
		icon: '🎓',
		category: 'Education',
		estimatedDuration: '6-12 months',
		tasks: [
			{
				title: 'Research potential colleges',
				description: 'Create initial list based on academics, location, cost, and fit',
				type: 'task',
				priority: 1,
				executionType: 'ai_assisted',
				category: 'research'
			},
			{
				title: 'Register for standardized tests',
				description: 'Sign up for SAT/ACT and subject tests if needed',
				type: 'task',
				priority: 1,
				executionType: 'human',
				category: 'testing'
			},
			{
				title: 'Prepare for and take standardized tests',
				description: 'Study, take practice tests, and sit for actual exams',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [1],
				category: 'testing'
			},
			{
				title: 'Finalize college list',
				description: 'Narrow down to reach, match, and safety schools',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [0, 2],
				category: 'decision'
			},
			{
				title: 'Request teacher recommendations',
				description: 'Ask teachers early and provide them with helpful context',
				type: 'task',
				priority: 2,
				executionType: 'human',
				dependsOnIndex: [3],
				category: 'materials'
			},
			{
				title: 'Write personal statement and essays',
				description: 'Draft, revise, and polish application essays',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [3],
				category: 'writing'
			},
			{
				title: 'Complete and submit applications',
				description: 'Fill out all forms and submit by deadlines',
				type: 'task',
				priority: 0,
				executionType: 'human',
				dependsOnIndex: [4, 5],
				category: 'submission'
			},
			{
				title: 'Submit FAFSA and financial aid forms',
				description: 'Apply for federal and institutional financial aid',
				type: 'task',
				priority: 1,
				executionType: 'human_assisted',
				dependsOnIndex: [6],
				category: 'financial'
			},
			{
				title: 'Compare offers and make decision',
				description: 'Evaluate acceptances, financial aid, and make final choice',
				type: 'task',
				priority: 0,
				executionType: 'human_assisted',
				category: 'decision'
			}
		],
		tips: [
			'Start essays early - they take longer than you think',
			'Apply Early Decision only if you have a clear first choice',
			'Keep copies of everything you submit'
		]
	}
];

export const TEMPLATE_CATEGORIES = [...new Set(PROJECT_TEMPLATES.map(t => t.category))];
