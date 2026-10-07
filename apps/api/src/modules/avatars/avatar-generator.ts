// avatar-generator.ts
const PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#D4537E", "#F4C0D1"],
  ["#7F77DD", "#CECBF6"],
  ["#1D9E75", "#9FE1CB"],
  ["#D85A30", "#F5C4B3"],
  ["#378ADD", "#B5D4F4"],
  ["#BA7517", "#FAC775"],
  ["#639922", "#C0DD97"],
  ["#993556", "#ED93B1"],
  ["#534AB7", "#AFA9EC"],
  ["#0F6E56", "#5DCAA5"],
];

// Each shape is 4 rows of a 4x4 grid; '1' = filled cell.
const SHAPES: ReadonlyArray<readonly string[]> = [
  ["1000", "1100", "1110", "1111"], // stairs
  ["0110", "0110", "1111", "1111"], // tower
  ["0110", "1111", "1111", "0110"], // plus
  ["1111", "1111", "0110", "0110"], // T
  ["1100", "1100", "1111", "1111"], // L
  ["1111", "1111", "1001", "1001"], // bridge
  ["1100", "1100", "0011", "0011"], // checker
  ["1100", "1110", "0111", "0011"], // diagonal band
  ["0000", "0110", "1111", "1111"], // hill
  ["1010", "1010", "1010", "1111"], // comb
  ["1111", "1001", "1001", "1111"], // ring
  ["1111", "1100", "1100", "1100"], // corner
];

/** FNV-1a with a salt, then a murmur3-style finalizer. Returns an unsigned 32-bit int. */
export function hash(seed: string, salt: number): number {
  let x = 2166136261 ^ salt;
  for (const ch of seed) {
    x ^= ch.charCodeAt(0);
    x = Math.imul(x, 16777619);
  }
  x ^= x >>> 16;
  x = Math.imul(x, 2246822507);
  x ^= x >>> 13;
  x = Math.imul(x, 3266489909);
  x ^= x >>> 16;
  return x >>> 0;
}

export interface AvatarSpec {
  background: string;
  foreground: string;
  shape: readonly string[];
  rotation: 0 | 90 | 180 | 270;
}

export function avatarSpec(seed: string): AvatarSpec {
  const [deep, light] = PALETTE[hash(seed, 1) % PALETTE.length];
  const shape = SHAPES[hash(seed, 2) % SHAPES.length];
  const rotation = ((hash(seed, 3) % 4) * 90) as AvatarSpec["rotation"];
  const inverted = hash(seed, 4) % 5 === 0; // ~20% get light bg + deep shape
  return {
    background: inverted ? light : deep,
    foreground: inverted ? deep : light,
    shape,
    rotation,
  };
}

export function renderAvatarSvg(seed: string, size = 64): string {
  const { background, foreground, shape, rotation } = avatarSpec(seed);
  const clipId = `a${hash(seed, 9).toString(36)}`;

  let cells = "";
  shape.forEach((row, y) => {
    [...row].forEach((v, x) => {
      if (v === "1") {
        cells += `<rect x="${10 + x * 5}" y="${10 + y * 5}" width="5.05" height="5.05" fill="${foreground}"/>`;
      }
    });
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}" role="img" aria-label="Avatar">` +
    `<defs><clipPath id="${clipId}"><circle cx="20" cy="20" r="20"/></clipPath></defs>` +
    `<g clip-path="url(#${clipId})">` +
    `<rect width="40" height="40" fill="${background}"/>` +
    `<g transform="rotate(${rotation} 20 20)">${cells}</g>` +
    `</g></svg>`
  );
}
