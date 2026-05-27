import { prisma } from '../../src/backend/db/prisma';

// Each test starts from an empty table, so tests never depend on each other
// or on existing local data.
beforeEach(async () => {
  await prisma.task.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
