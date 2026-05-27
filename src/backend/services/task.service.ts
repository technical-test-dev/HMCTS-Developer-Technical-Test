import type { Task as PrismaTask } from '@prisma/client';
import { prisma } from '../db/prisma';
import { NotFoundError } from '../middleware/errorHandler';
import type {
  Task,
  TaskStatus,
  TaskGroup,
  TaskListQuery,
  TaskSortField,
} from '../../shared/types/task';
import type {
  CreateTaskParsed,
  UpdateTaskParsed,
} from '../validators/task.schema';

// True when two dates fall on the same calendar day in the server's timezone.
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Derives the urgency group for a task. A task due on today's calendar date is
// shown as due today, even if its exact due time has already passed.
function computeGroup(
  status: TaskStatus,
  dueDateTime: Date,
  now: Date,
): TaskGroup {
  if (status === 'COMPLETED') return 'COMPLETED';
  if (isSameDay(dueDateTime, now)) return 'DUE_TODAY';
  if (dueDateTime.getTime() < now.getTime()) return 'OVERDUE';
  return 'UPCOMING';
}

// Maps a Prisma row to the API/UI shape, adding the computed `overdue` flag and
// urgency `group`, and serialising dates to ISO strings.
function toTask(row: PrismaTask, now = new Date()): Task {
  const status = row.status as TaskStatus;
  const group = computeGroup(status, row.dueDateTime, now);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status,
    dueDateTime: row.dueDateTime.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    overdue: group === 'OVERDUE',
    group,
  };
}

// Rank used when sorting by status (logical workflow order).
const STATUS_RANK: Record<TaskStatus, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  COMPLETED: 2,
};

function compareTasks(field: TaskSortField): (a: Task, b: Task) => number {
  switch (field) {
    case 'title':
      return (a, b) => a.title.localeCompare(b.title);
    case 'status':
      return (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case 'createdAt':
      return (a, b) => a.createdAt.localeCompare(b.createdAt);
    case 'updatedAt':
      return (a, b) => a.updatedAt.localeCompare(b.updatedAt);
    case 'dueDateTime':
    default:
      return (a, b) => a.dueDateTime.localeCompare(b.dueDateTime);
  }
}

// Display order of the urgency groups in the workload view.
const GROUP_RANK: Record<TaskGroup, number> = {
  OVERDUE: 0,
  DUE_TODAY: 1,
  UPCOMING: 2,
  COMPLETED: 3,
};

export async function createTask(input: CreateTaskParsed): Promise<Task> {
  const row = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      dueDateTime: input.dueDateTime,
    },
  });
  return toTask(row);
}

export async function getAllTasks(
  query: Partial<TaskListQuery> = {},
): Promise<Task[]> {
  const rows = await prisma.task.findMany();
  const now = new Date();
  let tasks = rows.map((row) => toTask(row, now));

  // Filter. "OVERDUE" is a derived state, so it is filtered on the computed
  // flag rather than the stored status.
  if (query.status === 'OVERDUE') {
    tasks = tasks.filter((task) => task.overdue);
  } else if (query.status) {
    tasks = tasks.filter((task) => task.status === query.status);
  }

  // Sort (ascending by the chosen comparator, reversed for descending).
  tasks.sort(compareTasks(query.sort ?? 'dueDateTime'));
  if (query.order === 'desc') {
    tasks.reverse();
  }

  return tasks;
}

// Default number of tasks shown per page in the web UI.
export const DEFAULT_PAGE_SIZE = 10;

export interface PagedTasks {
  tasks: Task[];
  page: number; // clamped to a valid page
  perPage: number;
  total: number; // total matching the filter (before paging)
  totalPages: number;
  from: number; // 1-based index of the first item on this page (0 if none)
  to: number; // 1-based index of the last item on this page
}

// Returns a single page of tasks plus the metadata needed to render pagination.
// Filtering/sorting still happen in memory (the dataset is small and OVERDUE is
// a derived state), then the result is sliced for the requested page.
export async function getTasksPage(
  query: Partial<TaskListQuery> = {},
  page = 1,
  perPage = DEFAULT_PAGE_SIZE,
): Promise<PagedTasks> {
  const all = await getAllTasks(query);
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  const tasks = all.slice(start, start + perPage);
  return {
    tasks,
    page: safePage,
    perPage,
    total,
    totalPages,
    from: total === 0 ? 0 : start + 1,
    to: start + tasks.length,
  };
}

// Tasks for a single page of the workload view, partitioned into urgency
// groups. Filtering and sorting are applied first, then a stable sort by group
// rank keeps the chosen sort order within each group, then the flat list is
// sliced for the requested page and re-partitioned for display.
export interface GroupedTasksPage extends Omit<PagedTasks, 'tasks'> {
  groups: Record<TaskGroup, Task[]>;
}

export async function getGroupedTasksPage(
  query: Partial<TaskListQuery> = {},
  page = 1,
  perPage = DEFAULT_PAGE_SIZE,
): Promise<GroupedTasksPage> {
  const all = await getAllTasks(query);
  // Stable sort preserves the within-group ordering produced by getAllTasks.
  all.sort((a, b) => GROUP_RANK[a.group] - GROUP_RANK[b.group]);

  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  const pageTasks = all.slice(start, start + perPage);

  const groups: Record<TaskGroup, Task[]> = {
    OVERDUE: [],
    DUE_TODAY: [],
    UPCOMING: [],
    COMPLETED: [],
  };
  for (const task of pageTasks) {
    groups[task.group].push(task);
  }

  return {
    groups,
    page: safePage,
    perPage,
    total,
    totalPages,
    from: total === 0 ? 0 : start + 1,
    to: start + pageTasks.length,
  };
}

export async function getTaskById(id: string): Promise<Task> {
  const row = await prisma.task.findUnique({ where: { id } });
  if (!row) {
    throw new NotFoundError();
  }
  return toTask(row);
}

export async function updateTask(
  id: string,
  input: UpdateTaskParsed,
): Promise<Task> {
  await ensureExists(id);
  const row = await prisma.task.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      dueDateTime: input.dueDateTime,
    },
  });
  return toTask(row);
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<Task> {
  await ensureExists(id);
  const row = await prisma.task.update({ where: { id }, data: { status } });
  return toTask(row);
}

export async function deleteTask(id: string): Promise<void> {
  await ensureExists(id);
  await prisma.task.delete({ where: { id } });
}

async function ensureExists(id: string): Promise<void> {
  const count = await prisma.task.count({ where: { id } });
  if (count === 0) {
    throw new NotFoundError();
  }
}
