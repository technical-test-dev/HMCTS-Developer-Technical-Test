import Router from '@koa/router';
import { ZodError } from 'zod';
import * as taskService from '../services/task.service';
import { render } from '../views';
import {
  createTaskSchema,
  updateTaskSchema,
  updateStatusSchema,
  webListQuerySchema,
} from '../validators/task.schema';
import {
  WEB_SORT_OPTIONS,
  type WebSortKey,
  type TaskListQuery,
} from '../../shared/types/task';
import { NotFoundError } from '../middleware/errorHandler';

export const pageRouter = new Router();

// Mutating actions redirect with `?notice=<key>` (e.g. /?notice=created). The
// page reads that param and renders a GOV.UK notification banner, so success
// feedback works with or without JavaScript.

// Turns a ZodError into { field: message } for the GOV.UK error summary.
function fieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'value';
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

// Renders the shared 404 page for a missing task.
function render404(ctx: Router.RouterContext): void {
  ctx.status = 404;
  ctx.type = 'html';
  ctx.body = render('pages/not-found.njk', {});
}

// Maps the web "Sort by" key to the service's sort field and direction. The
// schema guarantees `sort` is a valid key, so the cast is safe.
function toServiceQuery(query: {
  status?: TaskListQuery['status'];
  sort: string;
}): Partial<TaskListQuery> {
  const { sort, order } = WEB_SORT_OPTIONS[query.sort as WebSortKey];
  return { status: query.status, sort, order };
}

// Builds a home-page URL that preserves the active filter/sort and sets the page.
function pageHref(
  query: { status?: string; sort?: string },
  page: number,
): string {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.sort) params.set('sort', query.sort);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

// Builds the view model the govukPagination component expects: previous/next
// links plus numbered items with ellipses around the current page.
function buildPagination(
  query: { status?: string; sort?: string },
  page: number,
  totalPages: number,
) {
  if (totalPages <= 1) return null;

  const wanted = new Set([1, totalPages, page, page - 1, page + 1]);
  const numbers = [...wanted]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<
    { ellipsis: true } | { number: number; href: string; current: boolean }
  > = [];
  let previous = 0;
  for (const n of numbers) {
    if (n - previous > 1) items.push({ ellipsis: true });
    items.push({ number: n, href: pageHref(query, n), current: n === page });
    previous = n;
  }

  return {
    items,
    previous: page > 1 ? { href: pageHref(query, page - 1) } : undefined,
    next: page < totalPages ? { href: pageHref(query, page + 1) } : undefined,
  };
}

// Workload view: tasks grouped by urgency, with filter, sort and pagination.
// Works fully without JavaScript — the controls are a plain GET form.
pageRouter.get('/', async (ctx) => {
  const { page, ...query } = webListQuerySchema.parse(ctx.query);
  const result = await taskService.getGroupedTasksPage(
    toServiceQuery(query),
    page,
  );
  ctx.type = 'html';
  ctx.body = render('pages/index.njk', {
    groups: result.groups,
    query,
    notice: ctx.query.notice,
    pagination: {
      ...result,
      nav: buildPagination(query, result.page, result.totalPages),
    },
  });
});

// Create task page.
pageRouter.get('/tasks/new', async (ctx) => {
  ctx.type = 'html';
  ctx.body = render('pages/task-new.njk', { values: {} });
});

// Create a task (no-JS form post; JS only adds instant client-side validation).
pageRouter.post('/tasks', async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>;
  try {
    const input = createTaskSchema.parse(body);
    await taskService.createTask(input);
    ctx.redirect('/?notice=created');
  } catch (err) {
    if (err instanceof ZodError) {
      ctx.status = 400;
      ctx.type = 'html';
      ctx.body = render('pages/task-new.njk', {
        values: body,
        errors: fieldErrors(err),
      });
      return;
    }
    throw err;
  }
});

// Task detail page (GOV.UK summary list + actions).
pageRouter.get('/tasks/:id', async (ctx) => {
  try {
    const task = await taskService.getTaskById(ctx.params.id);
    ctx.type = 'html';
    ctx.body = render('pages/task-detail.njk', {
      task,
      notice: ctx.query.notice,
      noticeStatus: ctx.query.status,
    });
  } catch (err) {
    if (err instanceof NotFoundError) return render404(ctx);
    throw err;
  }
});

// Edit task page.
pageRouter.get('/tasks/:id/edit', async (ctx) => {
  try {
    const task = await taskService.getTaskById(ctx.params.id);
    ctx.type = 'html';
    ctx.body = render('pages/task-edit.njk', { task, values: task });
  } catch (err) {
    if (err instanceof NotFoundError) return render404(ctx);
    throw err;
  }
});

// Update a task (no-JS form post; JS only adds instant client-side validation).
pageRouter.post('/tasks/:id/edit', async (ctx) => {
  const id = ctx.params.id;
  const body = ctx.request.body as Record<string, unknown>;
  try {
    const input = updateTaskSchema.parse(body);
    await taskService.updateTask(id, input);
    ctx.redirect(`/tasks/${id}?notice=updated`);
  } catch (err) {
    if (err instanceof ZodError) {
      try {
        const task = await taskService.getTaskById(id);
        ctx.status = 400;
        ctx.type = 'html';
        ctx.body = render('pages/task-edit.njk', {
          task,
          values: { ...body, id },
          errors: fieldErrors(err),
        });
        return;
      } catch (inner) {
        if (inner instanceof NotFoundError) return render404(ctx);
        throw inner;
      }
    }
    if (err instanceof NotFoundError) return render404(ctx);
    throw err;
  }
});

// Change a task's status (no-JS form post from the detail page).
pageRouter.post('/tasks/:id/status', async (ctx) => {
  const id = ctx.params.id;
  try {
    const { status } = updateStatusSchema.parse(ctx.request.body);
    await taskService.updateTaskStatus(id, status);
    ctx.redirect(`/tasks/${id}?notice=status&status=${status}`);
  } catch (err) {
    if (err instanceof NotFoundError) return render404(ctx);
    throw err;
  }
});

// Legacy delete confirmation URL. The confirmation now appears as a modal on
// the task detail page, so direct GET requests are sent back there.
pageRouter.get('/tasks/:id/delete', async (ctx) => {
  try {
    await taskService.getTaskById(ctx.params.id);
    ctx.redirect(`/tasks/${ctx.params.id}`);
  } catch (err) {
    if (err instanceof NotFoundError) return render404(ctx);
    throw err;
  }
});

// Delete a task.
pageRouter.post('/tasks/:id/delete', async (ctx) => {
  try {
    await taskService.deleteTask(ctx.params.id);
    ctx.redirect('/?notice=deleted');
  } catch (err) {
    if (err instanceof NotFoundError) return render404(ctx);
    throw err;
  }
});
