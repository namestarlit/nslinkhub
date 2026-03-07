import { BaseEntity } from 'src/common/entities/base.entity';
import { EntryKind } from 'src/common/enums/entry-kind.enum';
import { LinkEntity } from 'src/modules/links/entities/link.entity';
import { RepositoryEntity } from 'src/modules/repositories/entities/repository.entity';
import { EntryTagEntity } from 'src/modules/tags/entities/entry-tag.entity';
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

@Entity({ name: 'entries' })
@Unique('entries_repository_position_unique', ['repositoryId', 'position'])
@Index('idx_entries_repository_updated_at', ['repositoryId', 'updatedAt'])
@Check(
  'entries_external_requirements_check',
  `kind <> 'external_link' OR (link_id IS NOT NULL AND linked_repository_id IS NULL)`,
)
@Check(
  'entries_repository_link_requirements_check',
  `kind <> 'repository_link' OR (linked_repository_id IS NOT NULL AND link_id IS NULL)`,
)
export class EntryEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'repository_id' })
  repositoryId: string;

  @ManyToOne(() => RepositoryEntity, (repository) => repository.entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'repository_id' })
  repository: RepositoryEntity;

  @Column({ type: 'uuid', name: 'link_id', nullable: true })
  linkId: string | null;

  @ManyToOne(() => LinkEntity, (link) => link.entries, {
    nullable: true,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'link_id' })
  link: LinkEntity | null;

  @Column({ type: 'enum', enum: EntryKind })
  kind: EntryKind;

  @Column({ type: 'uuid', name: 'linked_repository_id', nullable: true })
  linkedRepositoryId: string | null;

  @ManyToOne(
    () => RepositoryEntity,
    (repository) => repository.linkedFromEntries,
    {
      nullable: true,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'linked_repository_id' })
  linkedRepository: RepositoryEntity | null;

  @Column({
    type: 'varchar',
    name: 'title_override',
    length: 255,
    nullable: true,
  })
  titleOverride: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'integer' })
  position: number;

  @VersionColumn({ type: 'bigint' })
  version: string;

  @OneToMany(() => EntryTagEntity, (entryTag) => entryTag.entry)
  entryTags: EntryTagEntity[];
}
