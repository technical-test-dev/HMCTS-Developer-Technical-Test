import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import path from 'path';

// Prepares an isolated, empty test database before the suite runs.
// We delete any leftover test database, then apply the committed migrations
// (a non-destructive operation) so the schema matches production exactly.
export default async function globalSetup(): Promise<void> {
  const dbPath = path.join(process.cwd(), 'prisma', 'test.db');
  for (const file of [dbPath, `${dbPath}-journal`]) {
    if (existsSync(file)) rmSync(file);
  }

  const env = { ...process.env, DATABASE_URL: 'file:./test.db' };
  try {
    execSync('npx prisma migrate deploy', { stdio: 'pipe', env });
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `prisma migrate deploy failed:\n${e.stdout?.toString() ?? ''}\n${e.stderr?.toString() ?? ''}`,
    );
  }
}
