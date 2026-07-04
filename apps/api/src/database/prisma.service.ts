import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "src/generated/prisma/client";

const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/nslinkhub";

function buildDatabaseUrl(configService: ConfigService): string {
  return configService.get<string>("DATABASE_URL", DEFAULT_DATABASE_URL);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: buildDatabaseUrl(configService),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
