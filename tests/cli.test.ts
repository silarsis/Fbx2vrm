import { describe, expect, it, vi } from "vitest";
import type { VRM } from "@pixiv/three-vrm";
import type { BoneMappingResult } from "../src/mapping/boneMap.js";
import { runCli } from "../src/cli/index.js";

describe("runCli", () => {
  it("returns help text when no args are provided", async () => {
    const result = await runCli([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stderr).toBe("");
  });

  it("returns an error for unknown commands", async () => {
    const result = await runCli(["unknown"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unknown command");
  });

  it("returns an error when convert arguments are missing", async () => {
    const result = await runCli(["convert"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("convert requires");
  });

  it("runs convert with parsed options and emits debug JSON", async () => {
    const boneMapping: BoneMappingResult = {
      mappings: {} as BoneMappingResult["mappings"],
      unmapped: [],
    };

    const convert = vi.fn(async () => ({
      vrm: {} as VRM,
      vrmFilePath: "output.vrm",
      warnings: ["Test warning"],
      boneMapping,
    }));

    const createResolver = vi.fn(() => async () => ({
      mappings: [],
      warnings: [],
    }));

    const result = await runCli(
      [
        "convert",
        "input.fbx",
        "output.vrm",
        "--confidence-threshold",
        "0.75",
        "--llm-model",
        "gpt-4o-mini",
        "--debug-json",
      ],
      {
        convert,
        createResolver,
        env: { OPENAI_API_KEY: "test-key" },
      },
    );

    expect(convert).toHaveBeenCalledWith(
      expect.objectContaining({
        inputPath: "input.fbx",
        outputPath: "output.vrm",
        minimumConfidence: 0.75,
        llmContext: undefined,
        llmResolver: expect.any(Function),
      }),
    );
    expect(createResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "test-key",
        model: "gpt-4o-mini",
      }),
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("\"warnings\"");
  });
});
