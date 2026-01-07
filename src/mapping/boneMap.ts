import type { FbxBoneInfo, FbxSkeletonInfo } from "../loaders/fbxLoader.js";
import { computeConfidence } from "./confidence.js";

export const vrmHumanoidBoneNames = [
  "hips",
  "spine",
  "chest",
  "upperChest",
  "neck",
  "head",
  "leftShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightShoulder",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "leftToes",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
  "rightToes",
  "leftEye",
  "rightEye",
  "jaw",
] as const;

export type VrmHumanoidBoneName = (typeof vrmHumanoidBoneNames)[number];

export type BoneMappingMatch = {
  target: VrmHumanoidBoneName;
  source: FbxBoneInfo;
  confidence: number;
  confidenceLevel: "low" | "medium" | "high";
  reasons: string[];
};

export type BoneMappingResult = {
  mappings: Record<VrmHumanoidBoneName, BoneMappingMatch | null>;
  unmapped: FbxBoneInfo[];
};

const prefixPatterns = [/^mixamorig[:_]/i, /^armature[:_]/i, /^bip\d*[:_]/i];

export const normalizeBoneName = (value: string): string => {
  let normalized = value.trim().toLowerCase();
  prefixPatterns.forEach((pattern) => {
    normalized = normalized.replace(pattern, "");
  });
  return normalized.replace(/[^a-z0-9]/g, "");
};

const synonymMap: Record<VrmHumanoidBoneName, string[]> = {
  hips: ["hips", "pelvis", "hip", "root", "waist"],
  spine: ["spine", "spine1", "spine01", "abdomen"],
  chest: ["chest", "spine2", "spine02", "upperbody"],
  upperChest: ["upperchest", "spine3", "spine03"],
  neck: ["neck"],
  head: ["head", "headend"],
  leftShoulder: ["leftshoulder", "leftclavicle", "lclavicle"],
  leftUpperArm: ["leftupperarm", "leftarm", "lupperarm", "luparm"],
  leftLowerArm: ["leftlowerarm", "leftforearm", "llowerarm", "llarm"],
  leftHand: ["lefthand", "leftwrist", "lhand"],
  rightShoulder: ["rightshoulder", "rightclavicle", "rclavicle"],
  rightUpperArm: ["rightupperarm", "rightarm", "rupperarm", "ruparm"],
  rightLowerArm: ["rightlowerarm", "rightforearm", "rlowerarm", "rlarm"],
  rightHand: ["righthand", "rightwrist", "rhand"],
  leftUpperLeg: ["leftupperleg", "leftupleg", "leftthigh", "lthigh"],
  leftLowerLeg: ["leftlowerleg", "leftleg", "leftcalf", "lcalf"],
  leftFoot: ["leftfoot", "leftankle", "lfoot"],
  leftToes: ["lefttoes", "lefttoe", "leftball", "ltoe"],
  rightUpperLeg: ["rightupperleg", "rightupleg", "rightthigh", "rthigh"],
  rightLowerLeg: ["rightlowerleg", "rightleg", "rightcalf", "rcalf"],
  rightFoot: ["rightfoot", "rightankle", "rfoot"],
  rightToes: ["righttoes", "righttoe", "rightball", "rtoe"],
  leftEye: ["lefteye", "leye"],
  rightEye: ["righteye", "reye"],
  jaw: ["jaw", "chin"],
};

const parentHints: Partial<Record<VrmHumanoidBoneName, VrmHumanoidBoneName>> = {
  spine: "hips",
  chest: "spine",
  upperChest: "chest",
  neck: "upperChest",
  head: "neck",
  leftShoulder: "upperChest",
  rightShoulder: "upperChest",
  leftUpperArm: "leftShoulder",
  rightUpperArm: "rightShoulder",
  leftLowerArm: "leftUpperArm",
  rightLowerArm: "rightUpperArm",
  leftHand: "leftLowerArm",
  rightHand: "rightLowerArm",
  leftUpperLeg: "hips",
  rightUpperLeg: "hips",
  leftLowerLeg: "leftUpperLeg",
  rightLowerLeg: "rightUpperLeg",
  leftFoot: "leftLowerLeg",
  rightFoot: "rightLowerLeg",
  leftToes: "leftFoot",
  rightToes: "rightFoot",
};

const hasSideToken = (value: string): "left" | "right" | null => {
  const lowered = value.toLowerCase();
  if (lowered.includes("left")) {
    return "left";
  }
  if (lowered.includes("right")) {
    return "right";
  }
  if (/(^|[^a-z])l(?![a-z])/.test(lowered)) {
    return "left";
  }
  if (/(^|[^a-z])r(?![a-z])/.test(lowered)) {
    return "right";
  }
  if (lowered.startsWith("l")) {
    return "left";
  }
  if (lowered.startsWith("r")) {
    return "right";
  }
  return null;
};

const expectedSideForTarget = (target: VrmHumanoidBoneName): "left" | "right" | null => {
  if (target.startsWith("left")) {
    return "left";
  }
  if (target.startsWith("right")) {
    return "right";
  }
  return null;
};

const scoreNameMatch = (boneName: string, target: VrmHumanoidBoneName): number => {
  const normalized = normalizeBoneName(boneName);
  const synonyms = synonymMap[target];
  const targetNormalized = normalizeBoneName(target);
  if (normalized === targetNormalized || synonyms.includes(normalized)) {
    return 1;
  }
  if (synonyms.some((synonym) => normalized.includes(synonym))) {
    return 0.75;
  }
  if (normalized.includes(targetNormalized)) {
    return 0.5;
  }
  return 0;
};

const scoreStructuralHint = (
  bone: FbxBoneInfo,
  target: VrmHumanoidBoneName,
): number => {
  const expectedParent = parentHints[target];
  if (!expectedParent || !bone.parentName) {
    return 0;
  }
  const normalizedParent = normalizeBoneName(bone.parentName);
  const expectedSynonyms = synonymMap[expectedParent];
  if (
    normalizedParent === normalizeBoneName(expectedParent) ||
    expectedSynonyms.includes(normalizedParent)
  ) {
    return 1;
  }
  if (expectedSynonyms.some((synonym) => normalizedParent.includes(synonym))) {
    return 0.5;
  }
  return 0;
};

const scoreSpatialHint = (
  bone: FbxBoneInfo,
  target: VrmHumanoidBoneName,
  bounds: { minY: number; maxY: number },
): number => {
  const range = Math.max(0.001, bounds.maxY - bounds.minY);
  const normalizedY = (bone.position.y - bounds.minY) / range;

  const highBones = new Set([
    "head",
    "leftEye",
    "rightEye",
    "jaw",
    "neck",
  ]);
  const upperBones = new Set([
    "chest",
    "upperChest",
    "leftShoulder",
    "rightShoulder",
    "leftUpperArm",
    "rightUpperArm",
  ]);
  const midBones = new Set(["hips", "spine"]);
  const lowerBones = new Set([
    "leftUpperLeg",
    "rightUpperLeg",
    "leftLowerArm",
    "rightLowerArm",
    "leftHand",
    "rightHand",
  ]);
  const lowBones = new Set([
    "leftLowerLeg",
    "rightLowerLeg",
    "leftFoot",
    "rightFoot",
    "leftToes",
    "rightToes",
  ]);

  const category = highBones.has(target)
    ? { min: 0.75, max: 1 }
    : upperBones.has(target)
      ? { min: 0.55, max: 0.85 }
      : midBones.has(target)
        ? { min: 0.35, max: 0.65 }
        : lowerBones.has(target)
          ? { min: 0.25, max: 0.6 }
          : lowBones.has(target)
            ? { min: 0, max: 0.35 }
            : { min: 0, max: 1 };

  if (normalizedY >= category.min && normalizedY <= category.max) {
    return 1;
  }
  const distance = Math.min(
    Math.abs(normalizedY - category.min),
    Math.abs(normalizedY - category.max),
  );
  return distance <= 0.15 ? 0.5 : 0;
};

const scoreSideHint = (bone: FbxBoneInfo, target: VrmHumanoidBoneName): number => {
  const expectedSide = expectedSideForTarget(target);
  if (!expectedSide) {
    return 0;
  }

  const nameSide = hasSideToken(bone.name);
  const positionSide = bone.position.x < 0 ? "left" : "right";
  const detectedSide = nameSide ?? positionSide;

  return detectedSide === expectedSide ? 1 : 0;
};

export const mapHumanoidBones = (skeleton: FbxSkeletonInfo): BoneMappingResult => {
  const minimumConfidence = 0.5;
  const bounds = skeleton.bones.reduce(
    (acc, bone) => {
      acc.minY = Math.min(acc.minY, bone.position.y);
      acc.maxY = Math.max(acc.maxY, bone.position.y);
      return acc;
    },
    { minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  );

  const usedBones = new Set<FbxBoneInfo>();
  const mappings = {} as Record<VrmHumanoidBoneName, BoneMappingMatch | null>;

  for (const target of vrmHumanoidBoneNames) {
    let best: BoneMappingMatch | null = null;

    for (const bone of skeleton.bones) {
      if (usedBones.has(bone)) {
        continue;
      }

      const nameScore = scoreNameMatch(bone.name, target);
      const structuralScore = scoreStructuralHint(bone, target);
      const spatialScore = scoreSpatialHint(bone, target, bounds);
      const sideScore = scoreSideHint(bone, target);

      const { score, level } = computeConfidence({
        name: nameScore,
        structural: structuralScore,
        spatial: spatialScore,
        side: sideScore,
      });

      if (!best || score > best.confidence) {
        const reasons = [];
        if (nameScore > 0) {
          reasons.push(`name:${nameScore.toFixed(2)}`);
        }
        if (structuralScore > 0) {
          reasons.push(`structure:${structuralScore.toFixed(2)}`);
        }
        if (spatialScore > 0) {
          reasons.push(`spatial:${spatialScore.toFixed(2)}`);
        }
        if (sideScore > 0) {
          reasons.push(`side:${sideScore.toFixed(2)}`);
        }

        best = {
          target,
          source: bone,
          confidence: score,
          confidenceLevel: level,
          reasons,
        };
      }
    }

    if (best && best.confidence >= minimumConfidence) {
      mappings[target] = best;
      usedBones.add(best.source);
    } else {
      mappings[target] = null;
    }
  }

  const unmapped = skeleton.bones.filter((bone) => !usedBones.has(bone));

  return { mappings, unmapped };
};
