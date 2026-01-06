import { Bone, BufferGeometry, Group, SkinnedMesh, Skeleton } from "three";
import { describe, expect, it } from "vitest";
import { extractFbxData } from "../src/loaders/fbxLoader.js";

const createSkinnedMesh = (name: string, skeleton: Skeleton): SkinnedMesh => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", { count: 3, itemSize: 3 } as never);
  const mesh = new SkinnedMesh(geometry, undefined);
  mesh.name = name;
  mesh.bind(skeleton);

  return mesh;
};

describe("extractFbxData", () => {
  it("normalizes bones and associates meshes with skeletons", () => {
    const root = new Bone();
    root.name = "Hips";
    const child = new Bone();
    child.name = "Spine";
    root.add(child);

    const skeleton = new Skeleton([root, child]);
    const group = new Group();
    group.add(createSkinnedMesh("Body", skeleton));

    const result = extractFbxData(group);

    expect(result.skeletons).toHaveLength(1);
    expect(result.meshes).toHaveLength(1);
    expect(result.meshes[0]).toMatchObject({
      name: "Body",
      skeletonIndex: 0,
      vertexCount: 3,
    });
    expect(result.skeletons[0].bones).toEqual([
      {
        name: "Hips",
        parentName: null,
        position: { x: 0, y: 0, z: 0 },
      },
      {
        name: "Spine",
        parentName: "Hips",
        position: { x: 0, y: 0, z: 0 },
      },
    ]);
  });

  it("reuses skeleton entries for multiple meshes", () => {
    const root = new Bone();
    root.name = "Root";
    const skeleton = new Skeleton([root]);
    const group = new Group();
    group.add(createSkinnedMesh("MeshA", skeleton));
    group.add(createSkinnedMesh("MeshB", skeleton));

    const result = extractFbxData(group);

    expect(result.skeletons).toHaveLength(1);
    expect(result.meshes).toEqual([
      { name: "MeshA", skeletonIndex: 0, vertexCount: 3 },
      { name: "MeshB", skeletonIndex: 0, vertexCount: 3 },
    ]);
  });
});
