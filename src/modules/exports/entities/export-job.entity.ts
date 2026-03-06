import { BaseEntity } from 'src/common/entities/base.entity';
import { RepositoryEntity } from 'src/modules/repositories/entities/repository.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

export type ExportJobStatus = 'queued' | 'running' | 'completed' | 'failed';

@Entity({ name: 'export_jobs' })
export class ExportJobEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'repository_id' })
  repositoryId: string;

  @ManyToOne(() => RepositoryEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'repository_id' })
  repository: RepositoryEntity;

  @Column({ type: 'uuid', name: 'requested_by_user_id', nullable: true })
  requestedByUserId: string | null;

  @ManyToOne(() => UserEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedByUser: UserEntity | null;

  @Column({ type: 'varchar', length: 16 })
  format: 'pdf';

  @Column({ type: 'varchar', length: 16 })
  status: ExportJobStatus;

  @Column({ type: 'text', name: 'output_ref', nullable: true })
  outputRef: string | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;
}
