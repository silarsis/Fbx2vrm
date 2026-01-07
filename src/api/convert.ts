import type { VRM1Meta } from "@pixiv/three-vrm-core";
import type { VRM } from "@pixiv/three-vrm";
import type { FbxLoadResult, FbxSkeletonInfo } from "../loaders/fbxLoader.js";
import { loadFbxFromFile } from "../loaders/fbxLoader.js";
import type {
  BoneMappingMatch,
  BoneMappingResult,
  VrmHumanoidBoneName,
} from "../mapping/boneMap.js";
import { mapHumanoidBones } from "../mapping/boneMap.js";
import type { ConfidenceLevel } from "../mapping/confidence.js";
import type { LlmResolver, LlmResolverResult } from "../mapping/llmResolver.js";
import { resolveWithLlm } from "../mapping/llmResolver.js";
import { buildVrm, exportVrmToFile } from "../vrm/vrmBuilder.js";

export type ConversionOptions = {
  inputPath: string;
  outputPath: string;
  meta?: Partial<VRM1Meta>;
  autoUpdateHumanBones?: boolean;
  llmResolver?: LlmResolver;
  llmContext?: string;
  loadFbx?: (path: string) => Promise<FbxLoadResult>;
};

export type ConversionResult = {
  vrm: VRM;
  vrmFilePath: string;
  warnings: string[];
  boneMapping: BoneMappingResult;
  llmResult?: LlmResolverResult;
};

const selectSkeletonFromLoad = (loadResult: FbxLoadResult): FbxSkeletonInfo => {
  if (loadResult.skeletons.length === 0) {
    throw new Error("No skeletons found in FBX file.");
  }

  const meshWithSkeleton = loadResult.meshes
    .filter((mesh) => mesh.skeletonIndex !== null)
    .sort((a, b) => b.vertexCount - a.vertexCount)[0];

  if (meshWithSkeleton?.skeletonIndex !== null) {
    const fromMesh = loadResult.skeletons[meshWithSkeleton.skeletonIndex];
    if (fromMesh) {
      return fromMesh;
    }
  }

  return loadResult.skeletons.reduce((best, candidate) =>
    candidate.bones.length > best.bones.length ? candidate : best,
  );
};

const scoreToLevel = (score: number): ConfidenceLevel =>
  score >= 0.75 ? "high" : score >= 0.5 ? "medium" : "low";

const recalculateUnmapped = (
  skeleton: FbxSkeletonInfo,
  mappings: BoneMappingResult["mappings"],
): FbxSkeletonInfo["bones"] => {
  const usedBones = new Set<string>();
  for (const match of Object.values(mappings)) {
    if (match) {
      usedBones.add(match.source.name);
    }
  }
  return skeleton.bones.filter((bone) => !usedBones.has(bone.name));
};

const applyLlmMappings = (
  skeleton: FbxSkeletonInfo,
  baseMapping: BoneMappingResult,
  llmResult: LlmResolverResult,
): { mapping: BoneMappingResult; warnings: string[] } => {
  const warnings: string[] = [];
  const updatedMappings = { ...baseMapping.mappings };
  const availableBones = new Map(
    skeleton.bones.map((bone) => [bone.name, bone]),
  );

  for (const suggestion of llmResult.mappings) {
    const target = suggestion.target as VrmHumanoidBoneName;
    if (updatedMappings[target]) {
      warnings.push(`LLM suggested ${target}, but mapping already exists.`);
      continue;
    }

    if (!suggestion.source) {
      warnings.push(`LLM did not provide a source for ${target}.`);
      continue;
    }

    const sourceBone = availableBones.get(suggestion.source);
    if (!sourceBone) {
      warnings.push(`LLM suggested unknown source bone ${suggestion.source}.`);
      continue;
    }

    const confidence = suggestion.confidence ?? 0.6;
    const match: BoneMappingMatch = {
      target,
      source: sourceBone,
      confidence,
      confidenceLevel: scoreToLevel(confidence),
      reasons: [suggestion.reasoning ?? "llm"],
    };

    updatedMappings[target] = match;
  }

  return {
    mapping: {
      mappings: updatedMappings,
      unmapped: recalculateUnmapped(skeleton, updatedMappings),
    },
    warnings,
  };
};

export const convertFbxToVrm = async (
  options: ConversionOptions,
): Promise<ConversionResult> => {
  const loader = options.loadFbx ?? loadFbxFromFile;
  const loadResult = await loader(options.inputPath);
  const skeleton = selectSkeletonFromLoad(loadResult);

  let mapping = mapHumanoidBones(skeleton);
  const warnings: string[] = [];
  let llmResult: LlmResolverResult | undefined;

  if (options.llmResolver) {
    const missingTargets = Object.entries(mapping.mappings)
      .filter(([, match]) => !match)
      .map(([target]) => target as VrmHumanoidBoneName);

    if (missingTargets.length > 0) {
      llmResult = await resolveWithLlm(options.llmResolver, {
        skeleton,
        targets: missingTargets,
        context: options.llmContext,
      });

      warnings.push(...llmResult.warnings);

      const merged = applyLlmMappings(skeleton, mapping, llmResult);
      mapping = merged.mapping;
      warnings.push(...merged.warnings);
    }
  }

  const { vrm, warnings: buildWarnings } = buildVrm({
    scene: loadResult.scene,
    boneMapping: mapping,
    meta: options.meta,
    autoUpdateHumanBones: options.autoUpdateHumanBones,
  });

  warnings.push(...buildWarnings);

  await exportVrmToFile(vrm, options.outputPath);

  return {
    vrm,
    vrmFilePath: options.outputPath,
    warnings,
    boneMapping: mapping,
    llmResult,
  };
};
