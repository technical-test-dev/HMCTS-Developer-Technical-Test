import type { Context } from 'koa';
import * as taskService from '../services/task.service';
import {
  createTaskSchema,
  updateTaskSchema,
  updateStatusSchema,
  idParamSchema,
  listQuerySchema,
} from '../validators/task.schema';

export async function createTask(ctx: Context): Promise<void> {
  const input = createTaskSchema.parse(ctx.request.body);
  const task = await taskService.createTask(input);
  ctx.status = 201;
  ctx.body = task;
}

export async function listTasks(ctx: Context): Promise<void> {
  const query = listQuerySchema.parse(ctx.query);
  ctx.status = 200;
  ctx.body = await taskService.getAllTasks(query);
}

export async function getTask(ctx: Context): Promise<void> {
  const { id } = idParamSchema.parse(ctx.params);
  ctx.status = 200;
  ctx.body = await taskService.getTaskById(id);
}

export async function updateTask(ctx: Context): Promise<void> {
  const { id } = idParamSchema.parse(ctx.params);
  const input = updateTaskSchema.parse(ctx.request.body);
  ctx.status = 200;
  ctx.body = await taskService.updateTask(id, input);
}

export async function updateTaskStatus(ctx: Context): Promise<void> {
  const { id } = idParamSchema.parse(ctx.params);
  const { status } = updateStatusSchema.parse(ctx.request.body);
  ctx.status = 200;
  ctx.body = await taskService.updateTaskStatus(id, status);
}

export async function deleteTask(ctx: Context): Promise<void> {
  const { id } = idParamSchema.parse(ctx.params);
  await taskService.deleteTask(id);
  ctx.status = 204;
}
