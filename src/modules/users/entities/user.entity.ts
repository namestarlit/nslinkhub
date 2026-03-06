import { BaseEntity } from 'src/common/entities/base.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { RepositoryEntity } from 'src/modules/repositories/entities/repository.entity';
import { Column, Entity, OneToMany } from 'typeorm';

@Entity({ name: 'users' })
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 60, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @OneToMany(() => RepositoryEntity, (repository) => repository.owner)
  repositories: RepositoryEntity[];
}
