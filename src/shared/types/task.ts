// Shared task types used by both the backend and the frontend

export const TASK_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

// UI labels for each status
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

// Fields the task list can be sorted by, and the sort directions
export const TASK_SORT_FIELDS = [
  'dueDateTime',
  'title',
  'status',
  'createdAt',
  'updatedAt',
] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export const TASK_SORT_ORDERS = ['asc', 'desc'] as const;
export type TaskSortOrder = (typeof TASK_SORT_ORDERS)[number];

// "OVERDUE" is not a stored status — it is derived from dueDateTime — but it is
// a valid value to filter the list by.
export type TaskStatusFilter = TaskStatus | 'OVERDUE';

export interface TaskListQuery {
  status?: TaskStatusFilter;
  sort: TaskSortField;
  order: TaskSortOrder;
}

// Urgency groups for the caseworker workload view. These are derived from the
// stored status and dueDateTime
export const TASK_GROUPS = [
  'OVERDUE',
  'DUE_TODAY',
  'UPCOMING',
  'COMPLETED',
] as const;
export type TaskGroup = (typeof TASK_GROUPS)[number];

// Heading and empty-state copy for each group
export const TASK_GROUP_META: Record<
  TaskGroup,
  { heading: string; empty: string; idPrefix: string }
> = {
  OVERDUE: {
    heading: 'Overdue',
    empty: 'There are no overdue tasks at the moment.',
    idPrefix: 'overdue',
  },
  DUE_TODAY: {
    heading: 'Due today',
    empty: 'There are no tasks due today.',
    idPrefix: 'due-today',
  },
  UPCOMING: {
    heading: 'Upcoming',
    empty: 'There are no upcoming tasks.',
    idPrefix: 'upcoming',
  },
  COMPLETED: {
    heading: 'Completed',
    empty: 'Completed tasks will appear here.',
    idPrefix: 'completed',
  },
};

// "Sort by" options Each collapses a sort field and direction into a single value so the workload view needs one dropdown
export const WEB_SORT_OPTIONS = {
  due_asc: { label: 'Due soonest first', sort: 'dueDateTime', order: 'asc' },
  due_desc: { label: 'Due latest first', sort: 'dueDateTime', order: 'desc' },
  created_desc: { label: 'Recently created', sort: 'createdAt', order: 'desc' },
  updated_desc: { label: 'Recently updated', sort: 'updatedAt', order: 'desc' },
} as const satisfies Record<
  string,
  { label: string; sort: TaskSortField; order: TaskSortOrder }
>;
export type WebSortKey = keyof typeof WEB_SORT_OPTIONS;
export const DEFAULT_WEB_SORT: WebSortKey = 'due_asc';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDateTime: string; 
  createdAt: string;
  updatedAt: string;
  // Computed: due date has passed and the task is not yet done.
  overdue: boolean;
  // Computed urgency group used by the workload view.
  group: TaskGroup;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  dueDateTime: string;
}

export interface UpdateTaskInput {
  title: string;
  description?: string;
  status: TaskStatus;
  dueDateTime: string;
}
