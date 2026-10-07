import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "../generated/prisma/client";

// Auth, operator commands and product mutations acquire this lock first.
export const AUTHORITY_LOCK = 74201931;
export const authorityContext = new AsyncLocalStorage<Prisma.TransactionClient>();
