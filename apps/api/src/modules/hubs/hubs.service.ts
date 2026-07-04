import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { createPersonalHub } from './hub-onboarding';

export type HubRole = 'owner' | 'admin' | 'member';

const ROLE_RANK: Record<string, number> = { member: 1, admin: 2, owner: 3 };

export function roleRank(role: string | null | undefined): number {
  return role ? (ROLE_RANK[role] ?? 0) : 0;
}

// Hub authority: creation, membership, and role checks. Collection-level
// access resolution lives in CollectionPolicyService; this service answers
// hub-scoped questions (who is a member, at what role).
@Injectable()
export class HubsService {
  constructor(private readonly prisma: PrismaService) {}

  createHubWithOwner(userId: string, params: { name: string }) {
    return createPersonalHub(this.prisma, { userId, name: params.name });
  }

  // The user's oldest owned hub — the personal hub created at sign-up. Used
  // as the default target for collection creation until hub-scoped creation
  // routes exist.
  async getPrimaryHubId(userId: string): Promise<string | null> {
    const membership = await this.prisma.hubMembership.findFirst({
      where: { userId, role: 'owner' },
      orderBy: { createdAt: 'asc' },
      select: { hubId: true },
    });
    return membership?.hubId ?? null;
  }

  async getMembershipRole(
    hubId: string,
    userId: string,
  ): Promise<string | null> {
    const membership = await this.prisma.hubMembership.findUnique({
      where: { hubId_userId: { hubId, userId } },
      select: { role: true },
    });
    return membership?.role ?? null;
  }

  async isMember(hubId: string, userId: string): Promise<boolean> {
    return (await this.getMembershipRole(hubId, userId)) !== null;
  }

  async countOwners(hubId: string): Promise<number> {
    return this.prisma.hubMembership.count({
      where: { hubId, role: 'owner' },
    });
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

  // Role-gated hub authority: platform admins bypass; otherwise the caller's
  // membership role must meet or exceed minRole.
  async requireHubRole(
    hubId: string,
    user: AuthUser,
    minRole: HubRole,
  ): Promise<void> {
    if (user.role === UserRole.ADMIN) {
      return;
    }
    const role = await this.getMembershipRole(hubId, user.userId);
    if (roleRank(role) < roleRank(minRole)) {
      throw new ForbiddenException('Forbidden');
    }
  }
}
