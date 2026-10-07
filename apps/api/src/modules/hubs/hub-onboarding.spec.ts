import { describe, expect, it } from "bun:test";
import { createPersonalHub } from "./hub-onboarding";

// In-memory stand-in for the hub delegate: unique handles, created rows echoed.
function fakeHubs(taken: string[] = []) {
  const handles = new Set(taken);
  return {
    hub: {
      findUnique: async ({ where }: { where: { handle: string } }) =>
        handles.has(where.handle) ? { handle: where.handle } : null,
      create: async ({ data }: { data: { handle: string; name: string } }) => {
        handles.add(data.handle);
        return data;
      },
    },
  } as unknown as Parameters<typeof createPersonalHub>[0];
}

describe("personal hub defaults", () => {
  it("keeps every word of a name-derived handle, even hex-looking ones", async () => {
    for (const [name, expected] of [
      ["John Beef", "John Beef"],
      ["Ada Face", "Ada Face"],
      ["Dead Beef", "Dead Beef"],
    ]) {
      const hub = (await createPersonalHub(fakeHubs(), { userId: "u", name })) as {
        name: string;
      };
      expect(hub.name).toBe(expected);
    }
  });

  it("never puts a retry suffix in the hub name", async () => {
    const hub = (await createPersonalHub(fakeHubs(["john-beef"]), {
      userId: "u",
      name: "John Beef",
    })) as { handle: string; name: string };
    expect(hub.handle).toBe("john-beef-2");
    expect(hub.name).toBe("John Beef");
  });

  it("drops only the random hex suffix from generated handles", async () => {
    const hub = (await createPersonalHub(fakeHubs(), { userId: "u", name: "" })) as {
      handle: string;
      name: string;
    };
    expect(hub.handle).toMatch(/^[a-z]+-[a-z]+-[a-f0-9]{4}$/);
    expect(hub.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });
});
