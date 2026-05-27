import type { Context, Next } from 'koa';
import { ZodError } from 'zod';

// Thrown by the service layer when a task cannot be found.
export class NotFoundError extends Error {
  constructor(message = 'Task not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Flattens a ZodError into a field -> message map for useful 400 responses.
function formatZodError(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'value';
    if (!details[key]) {
      details[key] = issue.message;
    }
  }
  return details;
}

// Central error handling middleware. Mounted first so it wraps every request.
export async function errorHandler(ctx: Context, next: Next): Promise<void> {
  try {
    await next();
  } catch (err) {
    if (err instanceof ZodError) {
      ctx.status = 400;
      ctx.body = {
        error: 'Validation failed',
        details: formatZodError(err),
      };
      return;
    }

    if (err instanceof NotFoundError) {
      ctx.status = 404;
      ctx.body = { error: err.message };
      return;
    }

    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
    ctx.app.emit('error', err, ctx);
  }
}
