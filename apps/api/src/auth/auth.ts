import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { readSecret } from "../config/secret";
import { emailConfig } from "../email/config";
import { PrismaClient } from "../generated/prisma/client";
import { createDeliveryAuth } from "./delivery-auth";

// The raw auth handler exists before Nest boots. Dependencies are composed here,
// while tests and future delivery wiring use the same explicit factory.
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      readSecret("DATABASE_URL") ?? "postgresql://postgres:postgres@127.0.0.1:5436/nslinkhub",
  }),
});
export const auth = createDeliveryAuth({
  supportUrl: emailConfig().supportUrl,
  suppressionSecret: emailConfig().suppressionSecret,
  prisma,
  secret: readSecret("BETTER_AUTH_SECRET") ?? "dev-better-auth-secret",
  // API-only local entry; align with port 3000 when the web proxy lands.
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:4000",
});

export type Auth = typeof auth;
