import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { readSecret } from "../config/secret";
import { PrismaClient } from "../generated/prisma/client";
import { createPersonalHub } from "../modules/hubs/hub-onboarding";

// Secrets follow the _FILE deployment contract (readSecret); local defaults
// keep dev zero-config.
function databaseUrl(): string {
  return readSecret("DATABASE_URL") ?? "postgresql://postgres:postgres@127.0.0.1:5432/nslinkhub";
}

// Dedicated client for better-auth (separate from Nest's PrismaService so the
// auth instance can exist before the Nest container does — it is mounted as
// raw Express middleware in main.ts and consumed by guards).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl() }),
});

export const auth = betterAuth({
  basePath: "/api/v1/auth",
  secret: readSecret("BETTER_AUTH_SECRET") ?? "dev-better-auth-secret",
  // The API's own origin (port 4000 in dev; 3000 belongs to the web app). In
  // production the web fronts the API same-origin, so this is the public origin.
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:4000",
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
