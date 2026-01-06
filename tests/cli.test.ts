import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli/index.js";

describe("runCli", () => {
  it("returns help text when no args are provided", () => {
    const result = runCli([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stderr).toBe("");
  });

  it("returns an error for unknown commands", () => {
    const result = runCli(["convert"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("CLI scaffold");
  });
});
