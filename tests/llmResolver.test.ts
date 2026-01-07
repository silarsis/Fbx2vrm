import { afterEach, describe, expect, it, vi } from "vitest";
import type { FbxSkeletonInfo } from "../src/loaders/fbxLoader.js";
import {
  createOpenAiResolver,
  validateLlmResponse,
} from "../src/mapping/llmResolver.js";

const createSkeleton = (): FbxSkeletonInfo => ({
  bones: [
    { name: "Hips", parentName: null, position: { x: 0, y: 1, z: 0 } },
    { name: "Spine", parentName: "Hips", position: { x: 0, y: 1.2, z: 0 } },
  ],
});

describe("validateLlmResponse", () => {
  it("accepts a valid mapping payload", () => {
    const result = validateLlmResponse(
      { mappings: [{ target: "hips", source: "Hips", confidence: 0.8 }] },
      createSkeleton(),
      ["hips"],
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.mappings).toHaveLength(1);
  });

  it("rejects unknown targets", () => {
    const result = validateLlmResponse(
      { mappings: [{ target: "unknown", source: "Hips" }] },
      createSkeleton(),
      ["hips"],
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Unknown target");
  });
});

describe("createOpenAiResolver", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses and validates OpenAI responses", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "gpt-4o-mini",
        choices: [
          {
            message: {
              content: "```json\n{\"mappings\":[{\"target\":\"hips\",\"source\":\"Hips\",\"confidence\":0.9}]}\n```",
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", mockFetch);

    const resolver = createOpenAiResolver({ apiKey: "test-key" });
    const result = await resolver({
      skeleton: createSkeleton(),
      targets: ["hips"],
    });

    expect(result.mappings[0].target).toBe("hips");
    expect(result.mappings[0].source).toBe("Hips");
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
