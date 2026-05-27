// Runs in each Jest worker before any modules (including Prisma) are imported,
// so the Prisma client connects to the isolated test database, never dev.db.
process.env.DATABASE_URL = 'file:./test.db';
process.env.NODE_ENV = 'test';
