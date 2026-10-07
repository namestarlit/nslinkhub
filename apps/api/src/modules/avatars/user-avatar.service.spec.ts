import { describe, expect, it, mock } from "bun:test";
import type { PrismaService } from "src/database/prisma.service";
import type { GravatarService } from "./gravatar.service";
import { UserAvatarService } from "./user-avatar.service";

const id = "01923456-789a-7bcd-8ef0-123456789abc";
function fixture(image: string | null = null, emailVerified = true) {
  const lookup = mock(async () => ({ image, emailVerified, email: "reader@example.com" }));
  const resolve = mock(async () => null as { body: Buffer; contentType: string } | null);
  const service = new UserAvatarService(
    { user: { findUnique: lookup } } as unknown as PrismaService,
    { resolve } as unknown as GravatarService,
  );
  return { service, lookup, resolve };
}
describe("own-account avatar selection", () => {
  it("does no personal lookup for anonymous or other-account requests", async () => {
    const { service, lookup, resolve } = fixture();
    for (const actor of [null, { userId: "someone-else" }]) {
      expect(await service.resolve(id, actor)).toEqual({ location: `/api/v1/avatars/${id}.svg` });
    }
    expect(lookup).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });
  it("prefers a chosen HTTPS picture without a Gravatar lookup", async () => {
    const { service, resolve } = fixture("https://images.example.com/chosen.png");
    expect(await service.resolve(id, { userId: id })).toEqual({
      location: "https://images.example.com/chosen.png",
    });
    expect(resolve).not.toHaveBeenCalled();
  });
  it("uses Gravatar for verified email and falls back to the immutable generator", async () => {
    const { service, resolve } = fixture("javascript:alert(1)");
    const image = { body: Buffer.from("image bytes"), contentType: "image/png" };
    resolve.mockResolvedValueOnce(image);
    expect(await service.resolve(id, { userId: id })).toEqual(image);
    expect(resolve).toHaveBeenCalledWith("reader@example.com");
    expect(await service.resolve(id, { userId: id })).toEqual({
      location: `/api/v1/avatars/${id}.svg`,
    });
    const unverified = fixture(null, false);
    await unverified.service.resolve(id, { userId: id });
    expect(unverified.resolve).not.toHaveBeenCalled();
  });
});
