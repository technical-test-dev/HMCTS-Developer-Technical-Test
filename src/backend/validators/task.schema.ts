import { z } from 'zod';
import {
  TASK_STATUSES,
  TASK_SORT_FIELDS,
  TASK_SORT_ORDERS,
  WEB_SORT_OPTIONS,
  DEFAULT_WEB_SORT,
} from '../../shared/types/task';

// Reusable field schemas.
const title = z
  .string({ required_error: 'Enter a task title' })
  .trim()
  .min(1, 'Enter a task title')
  .max(100, 'Title must be 100 characters or fewer');

const description = z
  .string()
  .trim()
  .max(500, 'Description must be 500 characters or fewer')
  .optional()
  // Treat an empty string as "no description".
  .transform((value) => (value === '' ? undefined : value));

const status = z.enum(TASK_STATUSES, {
  errorMap: () => ({
    message: 'Status must be NOT_STARTED, IN_PROGRESS or COMPLETED',
  }),
});

const dueDateTime = z.coerce.date({
  errorMap: () => ({ message: 'Enter a valid due date and time' }),
});

// POST /api/tasks
export const createTaskSchema = z.object({
  title,
  description,
  status: status.default('NOT_STARTED'),
  dueDateTime,
});

// PUT /api/tasks/:id — full update.
export const updateTaskSchema = z.object({
  title,
  description,
  status,
  dueDateTime,
});

// PATCH /api/tasks/:id/status — status only.
export const updateStatusSchema = z.object({
  status,
});

// GET /api/tasks and GET / — optional status filter, sort field and order.
// Lenient: any unrecognised value falls back to a sensible default rather than
// rejecting the request, so a hand-edited URL never errors.
export const listQuerySchema = z.object({
  status: z
    .enum([...TASK_STATUSES, 'OVERDUE'] as const)
    .optional()
    .catch(undefined),
  sort: z.enum(TASK_SORT_FIELDS).catch('dueDateTime'),
  order: z.enum(TASK_SORT_ORDERS).catch('asc'),
  page: z.coerce.number().int().positive().catch(1),
});

// GET / (the web workload view). The web UI uses a single "Sort by" dropdown
// whose values collapse a sort field and direction, plus the same status filter
// (including the derived OVERDUE). Lenient: unknown values fall back to defaults
// so a hand-edited URL never errors.
export const webListQuerySchema = z.object({
  status: z
    .enum([...TASK_STATUSES, 'OVERDUE'] as const)
    .optional()
    .catch(undefined),
  sort: z
    .enum(Object.keys(WEB_SORT_OPTIONS) as [string, ...string[]])
    .catch(DEFAULT_WEB_SORT),
  page: z.coerce.number().int().positive().catch(1),
});

// Route param.
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid task id'),
});

export type CreateTaskParsed = z.infer<typeof createTaskSchema>;
export type UpdateTaskParsed = z.infer<typeof updateTaskSchema>;
export type UpdateStatusParsed = z.infer<typeof updateStatusSchema>;
export type ListQueryParsed = z.infer<typeof listQuerySchema>;
export type WebListQueryParsed = z.infer<typeof webListQuerySchema>;
