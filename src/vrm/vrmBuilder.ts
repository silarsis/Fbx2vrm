import fs from "node:fs/promises";
import type { VRM1Meta, VRMHumanBones } from "@pixiv/three-vrm-core";
import { VRM, VRMHumanoid, VRMRequiredHumanBoneName } from "@pixiv/three-vrm";
import type { BoneMappingMatch, BoneMappingResult } from "../mapping/boneMap.js";
import type { VrmHumanoidBoneName } from "../mapping/boneMap.js";
import type { Bone, Group } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

export type VrmBuilderOptions = {
  scene: Group;
  boneMapping: BoneMappingResult;
  meta?: Partial<VRM1Meta>;
  autoUpdateHumanBones?: boolean;
};

export type VrmBuildResult = {
  vrm: VRM;
  warnings: string[];
};

const defaultMeta: VRM1Meta = {
  metaVersion: "1",
  name: "Converted VRM",
  authors: ["fbx2vrm"],
  licenseUrl: "https://vrm.dev/licenses/vrm-1.0/",
};

const collectBones = (scene: Group): Map<string, Bone> => {
  const bones = new Map<string, Bone>();
  scene.traverse((object) => {
    if ((object as Bone).isBone) {
      const bone = object as Bone;
      if (!bones.has(bone.name)) {
        bones.set(bone.name, bone);
      }
    }
  });
  return bones;
};

const mappingWarning = (
  target: VrmHumanoidBoneName,
  match: BoneMappingMatch | null,
): string | null => {
  if (!match) {
    return `Missing mapping for ${target}.`;
  }
  if (match.confidenceLevel === "low") {
    return `Low confidence mapping for ${target} (${match.source.name}).`;
  }
  return null;
};

const createHumanBones = (
  scene: Group,
  boneMapping: BoneMappingResult,
): { humanBones: VRMHumanBones; warnings: string[] } => {
  const bones = collectBones(scene);
  const warnings: string[] = [];
  const humanBones: Partial<Record<VrmHumanoidBoneName, { node: Bone }>> = {};

  for (const [target, match] of Object.entries(boneMapping.mappings)) {
    const name = target as VrmHumanoidBoneName;
    const warning = mappingWarning(name, match);
    if (warning) {
      warnings.push(warning);
    }
    if (!match) {
      continue;
    }

    const node = bones.get(match.source.name);
    if (!node) {
      warnings.push(`Bone node ${match.source.name} not found for ${name}.`);
      continue;
    }

    humanBones[name] = { node };
  }

  const missingRequired = Object.values(VRMRequiredHumanBoneName).filter(
    (requiredName) => !humanBones[requiredName],
  );

  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required humanoid bones: ${missingRequired.join(", ")}.`,
    );
  }

  return { humanBones: humanBones as VRMHumanBones, warnings };
};

export const buildVrm = (options: VrmBuilderOptions): VrmBuildResult => {
  const { scene, boneMapping } = options;
  const { humanBones, warnings } = createHumanBones(scene, boneMapping);
  const meta: VRM1Meta = {
    ...defaultMeta,
    ...options.meta,
    metaVersion: "1",
    authors: options.meta?.authors ?? defaultMeta.authors,
    licenseUrl: options.meta?.licenseUrl ?? defaultMeta.licenseUrl,
    name: options.meta?.name ?? defaultMeta.name,
  };

  const humanoid = new VRMHumanoid(humanBones, {
    autoUpdateHumanBones: options.autoUpdateHumanBones ?? true,
  });

  const vrm = new VRM({
    scene,
    meta,
    humanoid,
  });

  return { vrm, warnings };
};

const exportSceneToGlb = async (scene: Group): Promise<ArrayBuffer> =>
  await new Promise((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      class NodeFileReader {
        result: ArrayBuffer | null = null;
        onloadend: ((ev: ProgressEvent<FileReader>) => void) | null = null;

        readAsArrayBuffer(blob: Blob) {
          void blob.arrayBuffer().then((buffer) => {
            this.result = buffer;
            this.onloadend?.call(
              this as unknown as FileReader,
              null as unknown as ProgressEvent<FileReader>,
            );
          });
        }
      }

      globalThis.FileReader = NodeFileReader as unknown as typeof FileReader;
    }

    const exporter = new GLTFExporter();
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else if (result instanceof Uint8Array) {
          resolve(result.buffer);
        } else {
          reject(new Error("GLTFExporter did not return a binary buffer."));
        }
      },
      (error) => {
        reject(error ?? new Error("Failed to export GLB."));
      },
      { binary: true },
    );
  });

export const exportVrmToFile = async (
  vrm: VRM,
  outputPath: string,
): Promise<void> => {
  const buffer = await exportSceneToGlb(vrm.scene);
  await fs.writeFile(outputPath, Buffer.from(buffer));
};
