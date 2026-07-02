import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { EntriesModule } from './modules/entries/entries.module';
import { ExportsModule } from './modules/exports/exports.module';
import { HealthModule } from './modules/health/health.module';
import { ImportsModule } from './modules/imports/imports.module';
import { LinksModule } from './modules/links/links.module';
import { RepositoriesModule } from './modules/repositories/repositories.module';
import { TagsModule } from './modules/tags/tags.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    RepositoriesModule,
    LinksModule,
    EntriesModule,
    TagsModule,
    ImportsModule,
    ExportsModule,
    HealthModule,
  ],
})
export class AppModule {}
