import { BaseEntity } from 'src/common/entities/base.entity';
import { EntryEntity } from 'src/modules/entries/entities/entry.entity';
import { Column, Entity, OneToMany } from 'typeorm';

@Entity({ name: 'links' })
export class LinkEntity extends BaseEntity {
  @Column({ type: 'text', name: 'canonical_url', unique: true })
  canonicalUrl: string;

  @Column({ type: 'varchar', name: 'url_hash', length: 64, unique: true })
  urlHash: string;

  @OneToMany(() => EntryEntity, (entry) => entry.link)
  entries: EntryEntity[];
}
