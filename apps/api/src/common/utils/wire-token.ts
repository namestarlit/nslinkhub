// SQL CHECK constraints constrain these persisted strings. Validate them at
// serialization too: never disguise a wider persistence type with an assertion.
export function wireToken<const T extends string>(value: string, allowed: readonly T[]): T {
  const token = allowed.find((candidate) => candidate === value);
  if (token === undefined) throw new Error("Unexpected persisted wire token");
  return token;
}
