import { createApp } from './app';

const port = Number(process.env.PORT) || 3000;

const app = createApp();

app.on('error', (err) => {
  // Errors that reach here have already produced a 500 response.
  console.error('Unhandled server error:', err);
});

app.listen(port, () => {
  console.log(`Caseworker Task Manager running at http://localhost:${port}`);
});
