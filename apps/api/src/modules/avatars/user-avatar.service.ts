import { Injectable } from "@nestjs/common";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { PrismaService } from "src/database/prisma.service";
import { type AvatarImage, GravatarService } from "./gravatar.service";

type ResolvedAvatar = { location: string } | AvatarImage;

@Injectable()
export class UserAvatarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gravatar: GravatarService,
  ) {}

  async resolve(id: string, actor: AuthUser | null): Promise<ResolvedAvatar> {
    const fallback = { location: `/api/v1/avatars/${id}.svg` };
    // The public route must not reveal whether a UUID belongs to an account.
    if (actor?.userId !== id) return fallback;
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { image: true, email: true, emailVerified: true },
    });
    if (!user) return fallback;
    if (user.image) {
      try {
        const image = new URL(user.image);
        if (image.protocol === "https:" && !image.username && !image.password) {
          return { location: image.href };
        }
      } catch {
        /* Invalid stored images fall through to automatic avatars. */
      }
    }
    if (!user.emailVerified) return fallback;
    return (await this.gravatar.resolve(user.email)) ?? fallback;
  }
}
