import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer, username } from 'better-auth/plugins';
import { PrismaClient } from '../generated/prisma/client';

function databaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:5432/nslinkhub'
  );
}

// Dedicated client for better-auth (separate from Nest's PrismaService so the
// auth instance can exist before the Nest container does — it is mounted as
// raw Express middleware in main.ts and consumed by guards).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl() }),
});

export const auth = betterAuth({
  basePath: '/api/v2/auth',
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-better-auth-secret',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    password: {
      // argon2id via Bun's native hasher instead of better-auth's default scrypt.
      hash: (password) => Bun.password.hash(password, 'argon2id'),
      verify: ({ hash, password }) => Bun.password.verify(password, hash),
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'user', input: false },
      bio: { type: 'string', required: false, input: false },
    },
  },
  advanced: {
    database: {
      // Let PostgreSQL generate uuid-v7 ids (app_uuid_v7 defaults).
      generateId: false,
    },
  },
  plugins: [username(), bearer()],
});

export type Auth = typeof auth;
