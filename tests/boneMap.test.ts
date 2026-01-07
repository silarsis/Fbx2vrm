import { describe, expect, it } from "vitest";
import type { FbxSkeletonInfo } from "../src/loaders/fbxLoader.js";
import {
  mapHumanoidBones,
  normalizeBoneName,
} from "../src/mapping/boneMap.js";
import { computeConfidence } from "../src/mapping/confidence.js";

const createSkeleton = (): FbxSkeletonInfo => ({
  bones: [
    { name: "Hips", parentName: null, position: { x: 0, y: 1, z: 0 } },
    { name: "Spine", parentName: "Hips", position: { x: 0, y: 1.2, z: 0 } },
    { name: "Chest", parentName: "Spine", position: { x: 0, y: 1.4, z: 0 } },
    { name: "Neck", parentName: "Chest", position: { x: 0, y: 1.6, z: 0 } },
    { name: "Head", parentName: "Neck", position: { x: 0, y: 1.8, z: 0 } },
    {
      name: "LeftArm",
      parentName: "Chest",
      position: { x: -0.5, y: 1.4, z: 0 },
    },
    {
      name: "LeftForeArm",
      parentName: "LeftArm",
      position: { x: -0.8, y: 1.3, z: 0 },
    },
    {
      name: "LeftHand",
      parentName: "LeftForeArm",
      position: { x: -1.0, y: 1.2, z: 0 },
    },
    {
      name: "RightArm",
      parentName: "Chest",
      position: { x: 0.5, y: 1.4, z: 0 },
    },
    {
      name: "RightForeArm",
      parentName: "RightArm",
      position: { x: 0.8, y: 1.3, z: 0 },
    },
    {
      name: "RightHand",
      parentName: "RightForeArm",
      position: { x: 1.0, y: 1.2, z: 0 },
    },
    {
      name: "LeftUpLeg",
      parentName: "Hips",
      position: { x: -0.3, y: 0.9, z: 0 },
    },
    {
      name: "LeftLeg",
      parentName: "LeftUpLeg",
      position: { x: -0.3, y: 0.5, z: 0 },
    },
    {
      name: "LeftFoot",
      parentName: "LeftLeg",
      position: { x: -0.3, y: 0.1, z: 0 },
    },
    {
      name: "RightUpLeg",
      parentName: "Hips",
      position: { x: 0.3, y: 0.9, z: 0 },
    },
    {
      name: "RightLeg",
      parentName: "RightUpLeg",
      position: { x: 0.3, y: 0.5, z: 0 },
    },
    {
      name: "RightFoot",
      parentName: "RightLeg",
      position: { x: 0.3, y: 0.1, z: 0 },
    },
  ],
});

describe("normalizeBoneName", () => {
  it("strips common prefixes and separators", () => {
    expect(normalizeBoneName("mixamorig:LeftArm")).toBe("leftarm");
  });
});

describe("mapHumanoidBones", () => {
  it("maps core humanoid bones with strong confidence", () => {
    const result = mapHumanoidBones(createSkeleton());

    const leftUpperArm = result.mappings.leftUpperArm;
    const rightFoot = result.mappings.rightFoot;

    expect(leftUpperArm?.source.name).toBe("LeftArm");
    expect(leftUpperArm?.confidence).toBeGreaterThanOrEqual(0.7);
    expect(rightFoot?.source.name).toBe("RightFoot");
    expect(rightFoot?.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("respects the minimum confidence threshold", () => {
    const result = mapHumanoidBones(createSkeleton(), { minimumConfidence: 0.8 });

    expect(result.mappings.leftUpperArm).toBeNull();
  });
});

describe("computeConfidence", () => {
  it("returns a high score when heuristics align", () => {
    const { score, level } = computeConfidence({
      name: 1,
      structural: 1,
      spatial: 1,
      side: 1,
    });

    expect(score).toBeCloseTo(1, 5);
    expect(level).toBe("high");
  });
});
