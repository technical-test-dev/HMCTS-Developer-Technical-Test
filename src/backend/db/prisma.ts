import { PrismaClient } from '@prisma/client';

// A single PrismaClient instance is shared across the app.
// In dev, tsx watch can re-evaluate modules, so we cache the client on globalThis
// to avoid exhausting database connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
