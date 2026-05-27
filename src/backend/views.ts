import path from 'path';
import nunjucks from 'nunjucks';
import {
  TASK_STATUS_LABELS,
  TASK_GROUP_META,
  TASK_GROUPS,
  WEB_SORT_OPTIONS,
} from '../shared/types/task';

const projectRoot = process.cwd();

// Configure Nunjucks to search our own views plus the govuk-frontend macros.
const env = nunjucks.configure(
  [
    path.join(projectRoot, 'src/frontend/views'),
    path.join(projectRoot, 'node_modules/govuk-frontend/dist'),
  ],
  {
    autoescape: true,
    noCache: process.env.NODE_ENV !== 'production',
  },
);

// Expose status labels, group metadata and sort options to every template.
env.addGlobal('STATUS_LABELS', TASK_STATUS_LABELS);
env.addGlobal('GROUP_META', TASK_GROUP_META);
env.addGlobal('GROUP_ORDER', TASK_GROUPS);
env.addGlobal('SORT_OPTIONS', WEB_SORT_OPTIONS);

// Formats an ISO date string for display, e.g. "28 May 2026 at 14:30".
env.addFilter('govukDateTime', (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${date} at ${time}`;
});

// Converts a date string to the value format datetime-local inputs require.
// Idempotent for values already in that format, and returns the original string
// unchanged when it cannot be parsed, so an invalid submitted value is still
// preserved when a form is re-rendered with errors.
env.addFilter('inputDateTime', (value: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
});

export function render(template: string, context: Record<string, unknown> = {}): string {
  return env.render(template, context);
}
