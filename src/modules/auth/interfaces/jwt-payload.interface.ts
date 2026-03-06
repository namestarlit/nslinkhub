import { UserRole } from 'src/common/enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  tokenType: 'access' | 'refresh';
}
