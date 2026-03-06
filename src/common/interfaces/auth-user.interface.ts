import { UserRole } from 'src/common/enums/user-role.enum';

export interface AuthUser {
  userId: string;
  username: string;
  role: UserRole;
}
