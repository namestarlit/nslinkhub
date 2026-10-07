import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { avatarSpec, hash, renderAvatarSvg } from "./avatar-generator";

describe("approved avatar generator", () => {
  it("preserves the prototype's byte-level reference outputs", () => {
    const references = [
      ["user-1", "e453ee5325480d97e3201f569bc79a696807c98a1df0784605fb81d9d9299933"],
      ["user-2", "bb6a3c5e1c4352b74d1dc2c5965f8d89ebb6da5c7a0d7a7a0a21cba1b169140c"],
      [
        "3f1c9a2e-0000-4000-8000-000000000000",
        "460e05869135aafa36a6495c3ebb5e5649e957bdc32b371a419908d2055d4be3",
      ],
    ];
    for (const [seed, digest] of references) {
      const svg = renderAvatarSvg(seed);
      expect(svg).toBe(renderAvatarSvg(seed));
      expect(createHash("sha256").update(svg).digest("hex")).toBe(digest);
      expect(svg).not.toContain(seed);
    }
    expect(avatarSpec("user-1")).not.toEqual(avatarSpec("user-2"));
  });

  it("uses every palette and shape with the approved inversion distribution", () => {
    const palettes = new Set<number>();
    const shapes = new Set<number>();
    const rotations = new Set<number>();
    let inverted = 0;
    // Reproducible pseudorandom seeds prevent flaky statistical assertions.
    for (let i = 0; i < 10000; i++) {
      const seed = createHash("sha256").update(`avatar-distribution-${i}`).digest("hex");
      palettes.add(hash(seed, 1) % 10);
      shapes.add(hash(seed, 2) % 12);
      rotations.add(avatarSpec(seed).rotation);
      if (hash(seed, 4) % 5 === 0) inverted++;
    }
    expect(palettes.size).toBe(10);
    expect(shapes.size).toBe(12);
    expect(rotations.size).toBe(4);
    expect(inverted).toBeGreaterThanOrEqual(1700);
    expect(inverted).toBeLessThanOrEqual(2300);
  });

  it("changes only output dimensions when size changes and never embeds a seed", () => {
    const seed = '<script>alert("seed")</script>';
    const original = renderAvatarSvg(seed);
    expect(renderAvatarSvg(seed, 128)).toBe(
      original.replace('width="64" height="64"', 'width="128" height="128"'),
    );
    expect(original).not.toContain("script");
    expect(original).toContain('width="5.05" height="5.05"');
  });
});
