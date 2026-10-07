import type { PrismaService } from "../../src/database/prisma.service";
// Test-only fixture. Production role grants require accepted invitations.
export async function changeOperatorGrant(
  prisma: PrismaService,
  input: { userId: string; grant: true; authority: string; version: number },
) {
  await prisma.operatorGrant.create({ data: { userId: input.userId, authority: input.authority } });
  await prisma.user.update({
    where: { id: input.userId },
    data: { operationsVersion: { increment: 1 } },
  });
}
