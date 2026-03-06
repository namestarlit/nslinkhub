import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntryEntity } from '../entries/entities/entry.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { ExportJobEntity } from './entities/export-job.entity';
import { ExportsController } from './exports.controller';
import { ExportsProcessor } from './exports.processor';
import { ExportsService } from './exports.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([RepositoryEntity, EntryEntity, ExportJobEntity]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }) as any,
    }),
    BullModule.registerQueue({ name: 'exports' }),
  ],
  controllers: [ExportsController],
  providers: [ExportsService, ExportsProcessor],
  exports: [ExportsService],
})
export class ExportsModule {}
