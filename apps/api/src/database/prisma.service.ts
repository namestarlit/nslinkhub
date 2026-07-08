import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { readSecret } from "src/config/secret";
import { PrismaClient } from "src/generated/prisma/client";

const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/nslinkhub";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        // DATABASE_URL_FILE (deployment secret) > DATABASE_URL > local default.
        connectionString: readSecret("DATABASE_URL") ?? DEFAULT_DATABASE_URL,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  // Readiness ping: proves the authoritative store answers queries.
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
