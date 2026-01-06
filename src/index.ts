export type ConversionResult = {
  vrmFilePath: string;
  warnings: string[];
};

export const placeholder = () => "fbx2vrm";

export * from "./loaders/fbxLoader.js";
