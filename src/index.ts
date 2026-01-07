export type ConversionResult = {
  vrmFilePath: string;
  warnings: string[];
};

export const placeholder = () => "fbx2vrm";

export * from "./loaders/fbxLoader.js";
export * from "./mapping/boneMap.js";
export * from "./mapping/confidence.js";
export * from "./mapping/llmResolver.js";
export * from "./vrm/vrmBuilder.js";
