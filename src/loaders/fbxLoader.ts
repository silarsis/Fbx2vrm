import fs from "node:fs/promises";
import type { Group, Skeleton } from "three";
import { Bone, SkinnedMesh, Vector3 } from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export type FbxBoneInfo = {
  name: string;
  parentName: string | null;
  position: { x: number; y: number; z: number };
};

export type FbxSkeletonInfo = {
  bones: FbxBoneInfo[];
};

export type FbxMeshInfo = {
  name: string;
  skeletonIndex: number | null;
  vertexCount: number;
};

export type FbxLoadResult = {
  scene: Group;
  skeletons: FbxSkeletonInfo[];
  meshes: FbxMeshInfo[];
};

const normalizeName = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

const toPosition = (vector: Vector3) => ({
  x: vector.x,
  y: vector.y,
  z: vector.z,
});

export const extractFbxData = (scene: Group): FbxLoadResult => {
  const skeletons: FbxSkeletonInfo[] = [];
  const meshes: FbxMeshInfo[] = [];
  const skeletonMap = new Map<string, number>();

  const getSkeletonIndex = (skeleton: Skeleton): number => {
    const existing = skeletonMap.get(skeleton.uuid);
    if (existing !== undefined) {
      return existing;
    }

    const bones = skeleton.bones.map((bone, index) => {
      const parent = bone.parent instanceof Bone ? bone.parent : null;

      return {
        name: normalizeName(bone.name, `Bone_${index}`),
        parentName: parent ? normalizeName(parent.name, `Bone_${index}_parent`) : null,
        position: toPosition(bone.position),
      } satisfies FbxBoneInfo;
    });

    const skeletonInfo: FbxSkeletonInfo = { bones };
    const nextIndex = skeletons.length;
    skeletons.push(skeletonInfo);
    skeletonMap.set(skeleton.uuid, nextIndex);

    return nextIndex;
  };

  scene.traverse((object) => {
    const skinnedMesh = object as SkinnedMesh;
    if (!skinnedMesh.isSkinnedMesh) {
      return;
    }

    const skeletonIndex = skinnedMesh.skeleton
      ? getSkeletonIndex(skinnedMesh.skeleton)
      : null;
    const vertexCount = skinnedMesh.geometry.attributes.position?.count ?? 0;

    meshes.push({
      name: normalizeName(skinnedMesh.name, "SkinnedMesh"),
      skeletonIndex,
      vertexCount,
    });
  });

  return {
    scene,
    skeletons,
    meshes,
  };
};

const bufferToArrayBuffer = (buffer: Buffer): ArrayBuffer => {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.byteLength; i++) {
    view[i] = buffer[i];
  }
  return arrayBuffer;
};

export const loadFbxFromBuffer = (buffer: ArrayBuffer): FbxLoadResult => {
  const loader = new FBXLoader();
  const scene = loader.parse(buffer, "");

  return extractFbxData(scene);
};

export const loadFbxFromFile = async (
  filePath: string,
): Promise<FbxLoadResult> => {
  const buffer = await fs.readFile(filePath);
  return loadFbxFromBuffer(bufferToArrayBuffer(buffer));
};
