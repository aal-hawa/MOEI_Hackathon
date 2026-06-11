/**
 * Database Client for Worker
 * Uses Prisma with SQLite (same database as main project)
 * 
 * Imports PrismaClient from the root project's generated client.
 */

// Import from root project's Prisma client (generated at root node_modules)
import { PrismaClient } from '../../../node_modules/@prisma/client'

const globalForPrisma = globalThis as unknown as {
  workerPrisma: PrismaClient | undefined
}

// Reuse client in production, create fresh in development
if (!globalForPrisma.workerPrisma) {
  globalForPrisma.workerPrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error'],
  })
}

export const db = globalForPrisma.workerPrisma
