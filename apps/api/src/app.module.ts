import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./database/prisma.module";
import { CollectionsModule } from "./modules/collections/collections.module";
import { ExportsModule } from "./modules/exports/exports.module";
import { HealthModule } from "./modules/health/health.module";
import { HubsModule } from "./modules/hubs/hubs.module";
import { ImportsModule } from "./modules/imports/imports.module";
import { LinksModule } from "./modules/links/links.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { TagsModule } from "./modules/tags/tags.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    HubsModule,
    UsersModule,
    CollectionsModule,
    LinksModule,
    ResourcesModule,
    TagsModule,
    ImportsModule,
    ExportsModule,
    HealthModule,
  ],
})
export class AppModule {}
