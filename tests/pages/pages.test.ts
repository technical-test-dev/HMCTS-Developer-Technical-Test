import request from 'supertest';
import { createApp } from '../../src/backend/app';

const app = createApp().callback();

const MISSING_ID = '11111111-1111-1111-1111-111111111111';

// Creates a task through the JSON API and returns its id.
async function createTask(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/tasks')
    .send({
      title: 'Review case bundle',
      description: 'Check all documents are present',
      status: 'NOT_STARTED',
      dueDateTime: '2999-01-01T09:00',
      ...overrides,
    });
  return res.body;
}

// Today at 23:59, formatted for a datetime-local field — reliably "due today".
function todayLate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:59`;
}

describe('GET /', () => {
  it('loads the workload view with a Create task button', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Caseworker tasks');
    expect(res.text).toContain('href="/tasks/new"');
    // The full create form is no longer on the main page.
    expect(res.text).not.toContain('name="description"');
  });

  it('renders tasks as a GOV.UK Task List linking to the detail page', async () => {
    const task = await createTask({ title: 'Linked task' });
    const res = await request(app).get('/');
    expect(res.text).toContain('govuk-task-list');
    expect(res.text).toContain(`href="/tasks/${task.id}"`);
    expect(res.text).toContain('Linked task');
  });

  it('groups tasks by urgency with the right tags', async () => {
    await createTask({ title: 'Overdue task', dueDateTime: '2020-01-01T09:00' });
    await createTask({ title: 'Upcoming task', dueDateTime: '2999-01-01T09:00' });
    await createTask({ title: 'Due today task', dueDateTime: todayLate() });
    await createTask({ title: 'Done task', status: 'COMPLETED', dueDateTime: '2020-01-01T09:00' });

    const res = await request(app).get('/');
    expect(res.text).toContain('id="group-overdue"');
    expect(res.text).toContain('id="group-due-today"');
    expect(res.text).toContain('id="group-upcoming"');
    expect(res.text).toContain('id="group-completed"');
    expect(res.text).toContain('govuk-tag--red'); // overdue
    expect(res.text).toContain('govuk-tag--yellow'); // due today
  });

  it('shows a success toast after a redirect notice', async () => {
    const res = await request(app).get('/?notice=created');
    expect(res.text).toContain('data-success-toast');
    expect(res.text).toContain('Task created successfully.');
  });

  it('shows empty-state hints when there are no tasks', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('There are no tasks yet.');
  });
});

describe('GET /tasks/new', () => {
  it('loads the create task page with form fields', async () => {
    const res = await request(app).get('/tasks/new');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Create task');
    expect(res.text).toContain('name="title"');
    expect(res.text).toContain('name="dueDateTime"');
  });
});

describe('POST /tasks', () => {
  it('creates a task and redirects with a success notice', async () => {
    const res = await request(app)
      .post('/tasks')
      .type('form')
      .send({ title: 'New task', status: 'NOT_STARTED', dueDateTime: '2999-01-01T09:00' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/?notice=created');
  });

  it('re-renders with accessible validation errors and preserved values', async () => {
    const res = await request(app)
      .post('/tasks')
      .type('form')
      .send({ title: '', description: 'Keep me', status: 'NOT_STARTED', dueDateTime: '' });
    expect(res.status).toBe(400);
    expect(res.text).toContain('There is a problem');
    expect(res.text).toContain('Enter a task title');
    expect(res.text).toContain('href="#create-title"'); // summary links to field
    expect(res.text).toContain('Keep me'); // submitted value preserved
  });
});

describe('GET /tasks/:id', () => {
  it('loads the detail page with a summary list', async () => {
    const task = await createTask({ title: 'Detail task' });
    const res = await request(app).get(`/tasks/${task.id}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('govuk-summary-list');
    expect(res.text).toContain('Detail task');
    expect(res.text).toContain('Last updated');
    expect(res.text).toContain(`href="/tasks/${task.id}/edit"`);
    expect(res.text).toContain('data-delete-modal');
    expect(res.text).toContain(`action="/tasks/${task.id}/delete"`);
    expect(res.text).toContain('This action cannot be undone.');
  });

  it('returns 404 for a missing task', async () => {
    const res = await request(app).get(`/tasks/${MISSING_ID}`);
    expect(res.status).toBe(404);
    expect(res.text).toContain('Page not found');
  });
});

describe('GET /tasks/:id/edit', () => {
  it('loads the edit page pre-filled with the task values', async () => {
    const task = await createTask({ title: 'Editable task' });
    const res = await request(app).get(`/tasks/${task.id}/edit`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Edit task');
    expect(res.text).toContain('value="Editable task"');
  });

  it('returns 404 for a missing task', async () => {
    const res = await request(app).get(`/tasks/${MISSING_ID}/edit`);
    expect(res.status).toBe(404);
  });
});

describe('POST /tasks/:id/edit', () => {
  it('updates a task and redirects with a success notice', async () => {
    const task = await createTask();
    const res = await request(app)
      .post(`/tasks/${task.id}/edit`)
      .type('form')
      .send({ title: 'Updated title', description: 'Updated', status: 'IN_PROGRESS', dueDateTime: '2999-02-01T10:00' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/tasks/${task.id}?notice=updated`);

    const check = await request(app).get(`/api/tasks/${task.id}`);
    expect(check.body).toMatchObject({ title: 'Updated title', status: 'IN_PROGRESS' });
  });

  it('re-renders with validation errors on invalid input', async () => {
    const task = await createTask();
    const res = await request(app)
      .post(`/tasks/${task.id}/edit`)
      .type('form')
      .send({ title: '', status: 'NOT_STARTED', dueDateTime: '2999-02-01T10:00' });
    expect(res.status).toBe(400);
    expect(res.text).toContain('There is a problem');
    expect(res.text).toContain('Enter a task title');
  });
});

describe('POST /tasks/:id/status', () => {
  it('changes status and redirects with a status notice', async () => {
    const task = await createTask();
    const res = await request(app)
      .post(`/tasks/${task.id}/status`)
      .type('form')
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/tasks/${task.id}?notice=status&status=COMPLETED`);

    const banner = await request(app).get(res.headers.location);
    expect(banner.text).toContain('Task status changed to Completed.');
  });
});

describe('delete confirmation flow', () => {
  it('redirects the legacy confirmation URL back to the task detail page', async () => {
    const task = await createTask({ title: 'To delete' });
    const res = await request(app).get(`/tasks/${task.id}/delete`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/tasks/${task.id}`);

    // Still present — confirmation page must not delete.
    const check = await request(app).get(`/api/tasks/${task.id}`);
    expect(check.status).toBe(200);
  });

  it('deletes on confirmation and redirects with a notice', async () => {
    const task = await createTask();
    const res = await request(app).post(`/tasks/${task.id}/delete`).type('form').send({});
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/?notice=deleted');

    const check = await request(app).get(`/api/tasks/${task.id}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 for a missing task', async () => {
    const res = await request(app).get(`/tasks/${MISSING_ID}/delete`);
    expect(res.status).toBe(404);
  });
});
