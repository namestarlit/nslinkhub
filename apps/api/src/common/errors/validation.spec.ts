import { expect, it } from "bun:test";
import { IsString, validateSync } from "class-validator";
import { errorResponse } from "../filters/all-exceptions.filter";
import { validationException } from "./validation";

it("bounds actual validator output without returning values or attacker-named properties", () => {
  class WideDto {}
  for (let i = 0; i < 64; i++) IsString()(WideDto.prototype, `field${i}`);
  const target = Object.assign(new WideDto(), {
    ...Object.fromEntries(
      Array.from({ length: 64 }, (_, i) => [`field${i}`, { secret: "never-export" }]),
    ),
    "never-export-private-key": "never-export-value",
  });
  const failures = validateSync(target, { whitelist: true, forbidNonWhitelisted: true });
  const result = errorResponse(validationException(failures), "req_fixed");
  expect(result.body.error.code).toBe("validation_failed");
  if (result.body.error.code !== "validation_failed") throw new Error("Unexpected error code");
  expect(result.body.error.details.issues).toHaveLength(32);
  expect(JSON.stringify(result.body)).not.toContain("never-export");
  expect(result.body.error.details.issues).toContainEqual({ field: "$", rule: "unknown_field" });
});
