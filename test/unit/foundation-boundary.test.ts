// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("foundation boundary", () => {
  it("keeps AdapterContext independent from preferences implementation", () => {
    const source = readSource("src/foundation/context.ts");
    expect(source).toContain("../shared/preferences-shape");
    expect(source).not.toContain("../preferences/settings");
    expect(source).not.toContain("../preferences/schema");
  });

  it("keeps semantics from importing platform health directly", () => {
    const semanticsDir = join(process.cwd(), "src/foundation/semantics");
    const sources = readdirSync(semanticsDir)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(join(semanticsDir, file), "utf8"));

    expect(sources.join("\n")).not.toContain("../platform/health");
    expect(sources.join("\n")).not.toContain("../../platform/health");
  });
});
