import request from 'supertest';
import { createApp } from '../../src/backend/app';

const app = createApp().callback();

const validTask = {
  title: 'Review case bundle',
  description: 'Check all documents are present',
  status: 'NOT_STARTED',
  dueDateTime: '2026-07-01T14:30',
};

async function createTask(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/tasks')
    .send({ ...validTask, ...overrides });
  return res;
}

describe('POST /api/tasks', () => {
  it('creates a task and returns 201 with the created task', async () => {
    const res = await createTask();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: validTask.title,
      description: validTask.description,
      status: 'NOT_STARTED',
      overdue: false,
    });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.createdAt).toEqual(expect.any(String));
  });

  it('defaults status to NOT_STARTED when omitted', async () => {
    const res = await createTask({ status: undefined });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('NOT_STARTED');
  });

  it('rejects a missing title with 400', async () => {
    const res = await createTask({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('title');
  });

  it('rejects an invalid due date with 400', async () => {
    const res = await createTask({ dueDateTime: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('dueDateTime');
  });

  it('rejects an invalid status with 400', async () => {
    const res = await createTask({ status: 'NOPE' });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('status');
  });
});

describe('GET /api/tasks', () => {
  it('retrieves all tasks', async () => {
    await createTask({ title: 'Task one' });
    await createTask({ title: 'Task two' });
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('returns an empty array when there are no tasks', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/tasks/:id', () => {
  it('retrieves a task by id', async () => {
    const created = await createTask();
    const res = await request(app).get(`/api/tasks/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it('returns 404 for a missing task', async () => {
    const res = await request(app).get(
      '/api/tasks/11111111-1111-1111-1111-111111111111',
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe('PUT /api/tasks/:id', () => {
  it('fully updates a task', async () => {
    const created = await createTask();
    const res = await request(app)
      .put(`/api/tasks/${created.body.id}`)
      .send({
        title: 'Updated title',
        description: 'Updated description',
        status: 'IN_PROGRESS',
        dueDateTime: '2026-09-01T10:00',
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Updated title',
      description: 'Updated description',
      status: 'IN_PROGRESS',
    });
  });

  it('returns 404 when updating a missing task', async () => {
    const res = await request(app)
      .put('/api/tasks/11111111-1111-1111-1111-111111111111')
      .send(validTask);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/tasks/:id/status', () => {
  it('updates the status of a task', async () => {
    const created = await createTask();
    const res = await request(app)
      .patch(`/api/tasks/${created.body.id}/status`)
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('rejects an invalid status with 400', async () => {
    const created = await createTask();
    const res = await request(app)
      .patch(`/api/tasks/${created.body.id}/status`)
      .send({ status: 'INVALID' });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('status');
  });

  it('returns 404 when updating status of a missing task', async () => {
    const res = await request(app)
      .patch('/api/tasks/11111111-1111-1111-1111-111111111111/status')
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes a task and returns 204', async () => {
    const created = await createTask();
    const res = await request(app).delete(`/api/tasks/${created.body.id}`);
    expect(res.status).toBe(204);

    const check = await request(app).get(`/api/tasks/${created.body.id}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 when deleting a missing task', async () => {
    const res = await request(app).delete(
      '/api/tasks/11111111-1111-1111-1111-111111111111',
    );
    expect(res.status).toBe(404);
  });
});

describe('overdue flag', () => {
  it('marks a past-due, not-done task as overdue', async () => {
    const res = await createTask({ dueDateTime: '2020-01-01T09:00', status: 'NOT_STARTED' });
    expect(res.body.overdue).toBe(true);
  });

  it('marks a task due earlier today as due today, not overdue', async () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`;

    const res = await createTask({ dueDateTime: today, status: 'NOT_STARTED' });

    expect(res.body.group).toBe('DUE_TODAY');
    expect(res.body.overdue).toBe(false);
  });

  it('does not mark a done task as overdue', async () => {
    const res = await createTask({ dueDateTime: '2020-01-01T09:00', status: 'COMPLETED' });
    expect(res.body.overdue).toBe(false);
  });
});

describe('GET /api/tasks filtering and sorting', () => {
  it('filters by status', async () => {
    await createTask({ title: 'A', status: 'NOT_STARTED' });
    await createTask({ title: 'B', status: 'IN_PROGRESS' });
    await createTask({ title: 'C', status: 'COMPLETED' });

    const res = await request(app).get('/api/tasks?status=IN_PROGRESS');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('B');
  });

  it('filters by the derived OVERDUE state', async () => {
    await createTask({ title: 'Past due', dueDateTime: '2020-01-01T09:00', status: 'NOT_STARTED' });
    await createTask({ title: 'Future', dueDateTime: '2999-01-01T09:00', status: 'NOT_STARTED' });
    await createTask({ title: 'Done but past', dueDateTime: '2020-01-01T09:00', status: 'COMPLETED' });

    const res = await request(app).get('/api/tasks?status=OVERDUE');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Past due');
  });

  it('sorts by title ascending and descending', async () => {
    await createTask({ title: 'Banana' });
    await createTask({ title: 'Apple' });
    await createTask({ title: 'Cherry' });

    const asc = await request(app).get('/api/tasks?sort=title&order=asc');
    expect(asc.body.map((t: { title: string }) => t.title)).toEqual([
      'Apple',
      'Banana',
      'Cherry',
    ]);

    const desc = await request(app).get('/api/tasks?sort=title&order=desc');
    expect(desc.body.map((t: { title: string }) => t.title)).toEqual([
      'Cherry',
      'Banana',
      'Apple',
    ]);
  });

  it('defaults to due date ascending and ignores unknown params', async () => {
    await createTask({ title: 'Later', dueDateTime: '2026-12-01T09:00' });
    await createTask({ title: 'Sooner', dueDateTime: '2026-07-01T09:00' });

    const res = await request(app).get('/api/tasks?sort=nonsense&order=bogus');
    expect(res.status).toBe(200);
    expect(res.body.map((t: { title: string }) => t.title)).toEqual([
      'Sooner',
      'Later',
    ]);
  });
});

describe('GET / pagination (web page)', () => {
  async function seed(count: number) {
    for (let i = 1; i <= count; i += 1) {
      // Zero-pad so default (due date) ordering is stable and predictable.
      await createTask({
        title: `Task ${String(i).padStart(2, '0')}`,
        dueDateTime: `2026-07-${String(i).padStart(2, '0')}T09:00`,
      });
    }
  }

  it('shows no pagination nav when there are 10 or fewer tasks', async () => {
    await seed(10);
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Showing <strong>1</strong> to <strong>10</strong> of <strong>10</strong>');
    expect(res.text).not.toContain('govuk-pagination');
  });

  it('paginates to 10 per page and renders pagination nav', async () => {
    await seed(12);
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('govuk-pagination');
    expect(res.text).toContain('Task 01');
    expect(res.text).toContain('Task 10');
    expect(res.text).not.toContain('Task 11');
    expect(res.text).toContain('Showing <strong>1</strong> to <strong>10</strong> of <strong>12</strong>');
  });

  it('returns the second page of results', async () => {
    await seed(12);
    const res = await request(app).get('/?page=2');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Task 11');
    expect(res.text).toContain('Task 12');
    expect(res.text).not.toContain('Task 10');
    expect(res.text).toContain('Showing <strong>11</strong> to <strong>12</strong> of <strong>12</strong>');
  });

  it('clamps an out-of-range page to the last page', async () => {
    await seed(12);
    const res = await request(app).get('/?page=999');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Task 11');
    expect(res.text).toContain('Showing <strong>11</strong> to <strong>12</strong>');
  });

  it('preserves the status filter in pagination links', async () => {
    await seed(12);
    const res = await request(app).get('/?status=NOT_STARTED');
    // All seeded tasks default to NOT_STARTED, so paging links keep the filter
    // alongside the (defaulted) web sort key.
    expect(res.text).toContain(
      'href="/?status=NOT_STARTED&amp;sort=due_asc&amp;page=2"',
    );
  });
});
