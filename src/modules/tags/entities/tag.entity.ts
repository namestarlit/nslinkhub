import { BaseEntity } from 'src/common/entities/base.entity';
import { EntryTagEntity } from 'src/modules/tags/entities/entry-tag.entity';
import { RepositoryTagEntity } from 'src/modules/tags/entities/repository-tag.entity';
import { BeforeInsert, BeforeUpdate, Column, Entity, OneToMany } from 'typeorm';

@Entity({ name: 'tags' })
export class TagEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 80, unique: true })
  name: string;

  @OneToMany(() => RepositoryTagEntity, (repositoryTag) => repositoryTag.tag)
  repositoryTags: RepositoryTagEntity[];

  @OneToMany(() => EntryTagEntity, (entryTag) => entryTag.tag)
  entryTags: EntryTagEntity[];

  @BeforeInsert()
  @BeforeUpdate()
  normalizeName() {
    this.name = this.name.trim().replace(/\s+/g, ' ').toLowerCase();
  }
}
