import { BaseEntity } from 'src/common/entities/base.entity';
import { RepositoryVisibility } from 'src/common/enums/repository-visibility.enum';
import { EntryEntity } from 'src/modules/entries/entities/entry.entity';
import { RepositoryTagEntity } from 'src/modules/tags/entities/repository-tag.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
  VersionColumn,
} from 'typeorm';

@Entity({ name: 'repositories' })
@Unique('repositories_owner_slug_unique', ['ownerId', 'slug'])
@Index('idx_repositories_visibility_updated_at', ['visibility', 'updatedAt'])
@Index('idx_repositories_parent_repository_id', ['parentRepositoryId'])
@Check(
  'repositories_unlisted_requires_share_token_check',
  `visibility <> 'unlisted' OR share_token_hash IS NOT NULL`,
)
export class RepositoryEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => UserEntity, (user) => user.repositories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'owner_id' })
  owner: UserEntity;

  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: RepositoryVisibility,
    default: RepositoryVisibility.PRIVATE,
  })
  visibility: RepositoryVisibility;

  @Column({
    type: 'varchar',
    name: 'share_token_hash',
    length: 255,
    nullable: true,
  })
  shareTokenHash: string | null;

  @Column({ type: 'uuid', name: 'parent_repository_id', nullable: true })
  parentRepositoryId: string | null;

  @ManyToOne(() => RepositoryEntity, (repository) => repository.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_repository_id' })
  parentRepository: RepositoryEntity | null;

  @OneToMany(
    () => RepositoryEntity,
    (repository) => repository.parentRepository,
  )
  children: RepositoryEntity[];

  @OneToMany(() => EntryEntity, (entry) => entry.repository)
  entries: EntryEntity[];

  @OneToMany(() => EntryEntity, (entry) => entry.linkedRepository)
  linkedFromEntries: EntryEntity[];

  @OneToMany(
    () => RepositoryTagEntity,
    (repositoryTag) => repositoryTag.repository,
  )
  repositoryTags: RepositoryTagEntity[];

  @VersionColumn({ type: 'bigint' })
  version: string;
}
