import path from 'path';
import Koa from 'koa';
import { bodyParser } from '@koa/bodyparser';
import serve from 'koa-static';
import mount from 'koa-mount';
import { errorHandler } from './middleware/errorHandler';
import { apiTasksRouter } from './routes/api.tasks.routes';
import { pageRouter } from './routes/page.routes';

const projectRoot = process.cwd();

export function createApp(): Koa {
  const app = new Koa();

  // Central error handling wraps every request.
  app.use(errorHandler);

  // Parse JSON (API) and urlencoded (no-JS form) request bodies.
  app.use(bodyParser({ encoding: 'utf-8' }));

  // Static assets: our own CSS/JS, the GOV.UK assets, and vendored scripts.
  app.use(mount('/public', serve(path.join(projectRoot, 'src/frontend/public'))));
  app.use(
    mount(
      '/assets',
      serve(path.join(projectRoot, 'node_modules/govuk-frontend/dist/govuk/assets')),
    ),
  );
  app.use(
    mount(
      '/vendor/govuk',
      serve(path.join(projectRoot, 'node_modules/govuk-frontend/dist/govuk')),
    ),
  );
  app.use(
    mount('/vendor/alpine', serve(path.join(projectRoot, 'node_modules/alpinejs/dist'))),
  );

  // API routes.
  app.use(apiTasksRouter.routes());
  app.use(apiTasksRouter.allowedMethods());

  // Server-rendered pages.
  app.use(pageRouter.routes());
  app.use(pageRouter.allowedMethods());

  return app;
}
