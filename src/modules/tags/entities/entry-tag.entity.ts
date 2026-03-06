import { EntryEntity } from 'src/modules/entries/entities/entry.entity';
import { TagEntity } from 'src/modules/tags/entities/tag.entity';
import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity({ name: 'entry_tags' })
export class EntryTagEntity {
  @PrimaryColumn({ type: 'uuid', name: 'entry_id' })
  entryId: string;

  @PrimaryColumn({ type: 'uuid', name: 'tag_id' })
  tagId: string;

  @ManyToOne(() => EntryEntity, (entry) => entry.entryTags, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'entry_id' })
  entry: EntryEntity;

  @ManyToOne(() => TagEntity, (tag) => tag.entryTags, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tag_id' })
  tag: TagEntity;
}
