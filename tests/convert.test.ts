import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Bone, Group } from "three";
import type { FbxLoadResult, FbxSkeletonInfo } from "../src/loaders/fbxLoader.js";
import { convertFbxToVrm } from "../src/api/convert.js";
import type { LlmResolver } from "../src/mapping/llmResolver.js";

const createSceneAndSkeleton = (options?: {
  leftHandName?: string;
  leftHandParentName?: string;
}): { scene: Group; skeleton: FbxSkeletonInfo } => {
  const definitions = [
    { name: "Hips", parent: null, position: { x: 0, y: 0, z: 0 } },
    { name: "Spine", parent: "Hips", position: { x: 0, y: 0.5, z: 0 } },
    { name: "Head", parent: "Spine", position: { x: 0, y: 1.5, z: 0 } },
    {
      name: "LeftUpperArm",
      parent: "Spine",
      position: { x: -0.3, y: 1.2, z: 0 },
    },
    {
      name: "LeftLowerArm",
      parent: "LeftUpperArm",
      position: { x: -0.6, y: 1.1, z: 0 },
    },
    {
      name: options?.leftHandName ?? "LeftHand",
      parent: "LeftLowerArm",
      position: { x: -0.8, y: 1.0, z: 0 },
    },
    {
      name: "RightUpperArm",
      parent: "Spine",
      position: { x: 0.3, y: 1.2, z: 0 },
    },
    {
      name: "RightLowerArm",
      parent: "RightUpperArm",
      position: { x: 0.6, y: 1.1, z: 0 },
    },
    {
      name: "RightHand",
      parent: "RightLowerArm",
      position: { x: 0.8, y: 1.0, z: 0 },
    },
    {
      name: "LeftUpperLeg",
      parent: "Hips",
      position: { x: -0.2, y: -0.5, z: 0 },
    },
    {
      name: "LeftLowerLeg",
      parent: "LeftUpperLeg",
      position: { x: -0.2, y: -1.0, z: 0 },
    },
    {
      name: "LeftFoot",
      parent: "LeftLowerLeg",
      position: { x: -0.2, y: -1.2, z: 0 },
    },
    {
      name: "RightUpperLeg",
      parent: "Hips",
      position: { x: 0.2, y: -0.5, z: 0 },
    },
    {
      name: "RightLowerLeg",
      parent: "RightUpperLeg",
      position: { x: 0.2, y: -1.0, z: 0 },
    },
    {
      name: "RightFoot",
      parent: "RightLowerLeg",
      position: { x: 0.2, y: -1.2, z: 0 },
    },
  ];

  const bones = new Map<string, Bone>();
  for (const def of definitions) {
    const bone = new Bone();
    bone.name = def.name;
    bone.position.set(def.position.x, def.position.y, def.position.z);
    bones.set(def.name, bone);
  }

  for (const def of definitions) {
    if (def.parent) {
      const parent = bones.get(def.parent);
      const bone = bones.get(def.name);
      if (parent && bone) {
        parent.add(bone);
      }
    }
  }

  const scene = new Group();
  scene.add(bones.get("Hips") as Bone);

  const skeleton: FbxSkeletonInfo = {
    bones: definitions.map((def) => ({
      name: def.name,
      parentName:
        def.name === (options?.leftHandName ?? "LeftHand")
          ? options?.leftHandParentName ?? def.parent
          : def.parent,
      position: def.position,
    })),
  };

  return { scene, skeleton };
};

const createLoadResult = (
  skeleton: FbxSkeletonInfo,
  scene: Group,
): FbxLoadResult => ({
  scene,
  skeletons: [skeleton],
  meshes: [
    {
      name: "SkinnedMesh",
      skeletonIndex: 0,
      vertexCount: 1024,
    },
  ],
});

describe("convertFbxToVrm", () => {
  it("converts a FBX load result to a VRM file", async () => {
    const { scene, skeleton } = createSceneAndSkeleton();
    const loadResult = createLoadResult(skeleton, scene);

    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "fbx2vrm-"));
    const outputPath = path.join(outputDir, "model.vrm");

    const result = await convertFbxToVrm({
      inputPath: "dummy.fbx",
      outputPath,
      meta: { name: "Test Avatar" },
      loadFbx: async () => loadResult,
    });

    const stat = await fs.stat(result.vrmFilePath);
    expect(stat.size).toBeGreaterThan(0);
    expect(result.vrm.meta.name).toBe("Test Avatar");
    expect(result.boneMapping.mappings.hips?.source.name).toBe("Hips");
  });

  it("applies LLM mappings for missing targets", async () => {
    const { scene, skeleton } = createSceneAndSkeleton({
      leftHandName: "LeftPalm",
      leftHandParentName: "Root",
    });
    const loadResult = createLoadResult(skeleton, scene);

    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "fbx2vrm-"));
    const outputPath = path.join(outputDir, "model.vrm");

    const llmResolver: LlmResolver = async () => ({
      mappings: [
        {
          target: "leftHand",
          source: "LeftPalm",
          confidence: 0.8,
          reasoning: "LeftPalm is the hand bone.",
        },
      ],
      warnings: [],
    });

    const result = await convertFbxToVrm({
      inputPath: "dummy.fbx",
      outputPath,
      loadFbx: async () => loadResult,
      llmResolver,
    });

    expect(result.llmResult).toBeDefined();
    expect(result.boneMapping.mappings.leftHand?.source.name).toBe("LeftPalm");
  });
});
