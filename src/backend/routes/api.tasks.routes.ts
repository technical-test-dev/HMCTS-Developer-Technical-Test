import Router from '@koa/router';
import * as controller from '../controllers/task.controller';

// All task API endpoints, mounted under /api/tasks.
export const apiTasksRouter = new Router({ prefix: '/api/tasks' });

apiTasksRouter.post('/', controller.createTask);
apiTasksRouter.get('/', controller.listTasks);
apiTasksRouter.get('/:id', controller.getTask);
apiTasksRouter.put('/:id', controller.updateTask);
apiTasksRouter.patch('/:id/status', controller.updateTaskStatus);
apiTasksRouter.delete('/:id', controller.deleteTask);
