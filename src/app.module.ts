import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EntryEntity } from './modules/entries/entities/entry.entity';
import { LinkEntity } from './modules/links/entities/link.entity';
import { RepositoryEntity } from './modules/repositories/entities/repository.entity';
import { EntryTagEntity } from './modules/tags/entities/entry-tag.entity';
import { RepositoryTagEntity } from './modules/tags/entities/repository-tag.entity';
import { TagEntity } from './modules/tags/entities/tag.entity';
import { UserEntity } from './modules/users/entities/user.entity';
import { AuthModule } from './modules/auth/auth.module';
import { EntriesModule } from './modules/entries/entries.module';
import { ExportsModule } from './modules/exports/exports.module';
import { ExportJobEntity } from './modules/exports/entities/export-job.entity';
import { HealthModule } from './modules/health/health.module';
import { ImportsModule } from './modules/imports/imports.module';
import { LinksModule } from './modules/links/links.module';
import { RepositoriesModule } from './modules/repositories/repositories.module';
import { TagsModule } from './modules/tags/tags.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'nslinkhub'),
        synchronize: false,
        autoLoadEntities: true,
        entities: [
          UserEntity,
          RepositoryEntity,
          LinkEntity,
          EntryEntity,
          TagEntity,
          RepositoryTagEntity,
          EntryTagEntity,
          ExportJobEntity,
        ],
      }),
    }),
    AuthModule,
    UsersModule,
    RepositoriesModule,
    LinksModule,
    EntriesModule,
    TagsModule,
    ImportsModule,
    ExportsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
