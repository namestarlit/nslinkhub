import { RepositoryEntity } from 'src/modules/repositories/entities/repository.entity';
import { TagEntity } from 'src/modules/tags/entities/tag.entity';
import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity({ name: 'repository_tags' })
export class RepositoryTagEntity {
  @PrimaryColumn({ type: 'uuid', name: 'repository_id' })
  repositoryId: string;

  @PrimaryColumn({ type: 'uuid', name: 'tag_id' })
  tagId: string;

  @ManyToOne(
    () => RepositoryEntity,
    (repository) => repository.repositoryTags,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'repository_id' })
  repository: RepositoryEntity;

  @ManyToOne(() => TagEntity, (tag) => tag.repositoryTags, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tag_id' })
  tag: TagEntity;
}
