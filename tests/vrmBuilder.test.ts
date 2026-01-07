import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Bone, Group } from "three";
import type { BoneMappingMatch, BoneMappingResult } from "../src/mapping/boneMap.js";
import { vrmHumanoidBoneNames } from "../src/mapping/boneMap.js";
import { buildVrm, exportVrmToFile } from "../src/vrm/vrmBuilder.js";

const createBoneChain = () => {
  const hips = new Bone();
  hips.name = "Hips";

  const spine = new Bone();
  spine.name = "Spine";
  hips.add(spine);

  const head = new Bone();
  head.name = "Head";
  spine.add(head);

  const leftUpperArm = new Bone();
  leftUpperArm.name = "LeftUpperArm";
  spine.add(leftUpperArm);

  const leftLowerArm = new Bone();
  leftLowerArm.name = "LeftLowerArm";
  leftUpperArm.add(leftLowerArm);

  const leftHand = new Bone();
  leftHand.name = "LeftHand";
  leftLowerArm.add(leftHand);

  const rightUpperArm = new Bone();
  rightUpperArm.name = "RightUpperArm";
  spine.add(rightUpperArm);

  const rightLowerArm = new Bone();
  rightLowerArm.name = "RightLowerArm";
  rightUpperArm.add(rightLowerArm);

  const rightHand = new Bone();
  rightHand.name = "RightHand";
  rightLowerArm.add(rightHand);

  const leftUpperLeg = new Bone();
  leftUpperLeg.name = "LeftUpperLeg";
  hips.add(leftUpperLeg);

  const leftLowerLeg = new Bone();
  leftLowerLeg.name = "LeftLowerLeg";
  leftUpperLeg.add(leftLowerLeg);

  const leftFoot = new Bone();
  leftFoot.name = "LeftFoot";
  leftLowerLeg.add(leftFoot);

  const rightUpperLeg = new Bone();
  rightUpperLeg.name = "RightUpperLeg";
  hips.add(rightUpperLeg);

  const rightLowerLeg = new Bone();
  rightLowerLeg.name = "RightLowerLeg";
  rightUpperLeg.add(rightLowerLeg);

  const rightFoot = new Bone();
  rightFoot.name = "RightFoot";
  rightLowerLeg.add(rightFoot);

  const scene = new Group();
  scene.add(hips);

  return {
    scene,
    bones: {
      hips,
      spine,
      head,
      leftUpperArm,
      leftLowerArm,
      leftHand,
      rightUpperArm,
      rightLowerArm,
      rightHand,
      leftUpperLeg,
      leftLowerLeg,
      leftFoot,
      rightUpperLeg,
      rightLowerLeg,
      rightFoot,
    },
  };
};

const createMatch = (
  target: keyof BoneMappingResult["mappings"],
  name: string,
  parentName: string | null,
): BoneMappingMatch => ({
  target,
  source: {
    name,
    parentName,
    position: { x: 0, y: 0, z: 0 },
  },
  confidence: 0.9,
  confidenceLevel: "high",
  reasons: ["name:1.00"],
});

const createMapping = (): BoneMappingResult => {
  const mappings = Object.fromEntries(
    vrmHumanoidBoneNames.map((name) => [name, null]),
  ) as BoneMappingResult["mappings"];

  mappings.hips = createMatch("hips", "Hips", null);
  mappings.spine = createMatch("spine", "Spine", "Hips");
  mappings.head = createMatch("head", "Head", "Spine");
  mappings.leftUpperArm = createMatch("leftUpperArm", "LeftUpperArm", "Spine");
  mappings.leftLowerArm = createMatch(
    "leftLowerArm",
    "LeftLowerArm",
    "LeftUpperArm",
  );
  mappings.leftHand = createMatch("leftHand", "LeftHand", "LeftLowerArm");
  mappings.rightUpperArm = createMatch(
    "rightUpperArm",
    "RightUpperArm",
    "Spine",
  );
  mappings.rightLowerArm = createMatch(
    "rightLowerArm",
    "RightLowerArm",
    "RightUpperArm",
  );
  mappings.rightHand = createMatch("rightHand", "RightHand", "RightLowerArm");
  mappings.leftUpperLeg = createMatch(
    "leftUpperLeg",
    "LeftUpperLeg",
    "Hips",
  );
  mappings.leftLowerLeg = createMatch(
    "leftLowerLeg",
    "LeftLowerLeg",
    "LeftUpperLeg",
  );
  mappings.leftFoot = createMatch("leftFoot", "LeftFoot", "LeftLowerLeg");
  mappings.rightUpperLeg = createMatch(
    "rightUpperLeg",
    "RightUpperLeg",
    "Hips",
  );
  mappings.rightLowerLeg = createMatch(
    "rightLowerLeg",
    "RightLowerLeg",
    "RightUpperLeg",
  );
  mappings.rightFoot = createMatch("rightFoot", "RightFoot", "RightLowerLeg");

  return { mappings, unmapped: [] };
};

describe("buildVrm", () => {
  it("builds a VRM with required humanoid bones", () => {
    const { scene } = createBoneChain();
    const mapping = createMapping();

    const { vrm, warnings } = buildVrm({
      scene,
      boneMapping: mapping,
      meta: { name: "Unit Test Avatar" },
    });

    expect(vrm.humanoid.getRawBoneNode("hips")?.name).toBe("Hips");
    expect(vrm.meta.name).toBe("Unit Test Avatar");
    expect(warnings).toContain("Missing mapping for chest.");
    expect(warnings).toContain("Missing mapping for neck.");
  });

  it("throws when required bones are missing", () => {
    const { scene } = createBoneChain();
    const mapping = createMapping();
    mapping.mappings.leftHand = null;

    expect(() => buildVrm({ scene, boneMapping: mapping })).toThrow(
      "Missing required humanoid bones",
    );
  });
});

describe("exportVrmToFile", () => {
  it("exports a GLB buffer to disk", async () => {
    const { scene } = createBoneChain();
    const mapping = createMapping();
    const { vrm } = buildVrm({ scene, boneMapping: mapping });

    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "fbx2vrm-"));
    const outputPath = path.join(outputDir, "model.vrm");

    await exportVrmToFile(vrm, outputPath);

    const stat = await fs.stat(outputPath);
    expect(stat.size).toBeGreaterThan(0);
  });
});
