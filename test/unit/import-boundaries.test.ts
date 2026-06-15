// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("import boundary checker", () => {
  it("is wired as a repository script", () => {
    expect(existsSync(join(process.cwd(), "scripts/check-import-boundaries.mjs"))).toBe(true);
  });

  it("accepts the current DDD boundaries", () => {
    expect(() => {
      execFileSync(process.execPath, ["scripts/check-import-boundaries.mjs"], {
        cwd: process.cwd(),
        stdio: "pipe"
      });
    }).not.toThrow();
  });
});
