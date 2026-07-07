import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { PrismaClient } from "../generated/prisma/client";
import { createPersonalHub } from "../modules/hubs/hub-onboarding";

function databaseUrl(): string {
  return process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/nslinkhub";
}

// Dedicated client for better-auth (separate from Nest's PrismaService so the
// auth instance can exist before the Nest container does — it is mounted as
// raw Express middleware in main.ts and consumed by guards).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl() }),
});

export const auth = betterAuth({
  basePath: "/api/v1/auth",
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-better-auth-secret",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    password: {
      // argon2id via Bun's native hasher instead of better-auth's default scrypt.
      hash: (password) => Bun.password.hash(password, "argon2id"),
      verify: ({ hash, password }) => Bun.password.verify(password, hash),
    },
  },
  user: {
    additionalFields: {
      bio: { type: "string", required: false, input: false },
    },
  },
  advanced: {
    database: {
      // Let PostgreSQL generate uuid-v7 ids (app_uuid_v7 defaults).
      generateId: false,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Every new user gets their one personal hub (their space) at sign-up,
        // with a derived unique handle. App-owned and auth-path-agnostic: SSO
        // later reuses this hook.
        after: async (user) => {
          await createPersonalHub(prisma, {
            userId: user.id,
            name: user.name,
            email: user.email,
          });
        },
      },
    },
  },
  plugins: [bearer()],
});

export type Auth = typeof auth;
