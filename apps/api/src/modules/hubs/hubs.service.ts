import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { createPersonalHub } from './hub-onboarding';

// Interim hub authority for Phase B: hub creation and membership checks.
// Phase C grows this into the full policy service (role-aware
// requireHubRole, collection access resolution). For now every membership
// grants full content write, matching the resolved role model.
@Injectable()
export class HubsService {
  constructor(private readonly prisma: PrismaService) {}

  createHubWithOwner(userId: string, params: { name: string }) {
    return createPersonalHub(this.prisma, { userId, name: params.name });
  }

  // The user's oldest owned hub — the personal hub created at sign-up. Used
  // as the default target for collection creation until Phase C introduces
  // hub-scoped routes.
  async getPrimaryHubId(userId: string): Promise<string | null> {
    const membership = await this.prisma.hubMembership.findFirst({
      where: { userId, role: 'owner' },
      orderBy: { createdAt: 'asc' },
      select: { hubId: true },
    });
    return membership?.hubId ?? null;
  }

  async isMember(hubId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.hubMembership.findUnique({
      where: { hubId_userId: { hubId, userId } },
      select: { hubId: true },
    });
    return membership !== null;
  }

  // Write authority over a hub's content: platform admins bypass; otherwise
  // any membership suffices (members have full content write).
  async assertMember(hubId: string, user: AuthUser): Promise<void> {
    if (user.role === UserRole.ADMIN) {
      return;
    }
    if (!(await this.isMember(hubId, user.userId))) {
      throw new ForbiddenException('Forbidden');
    }
  }
}
