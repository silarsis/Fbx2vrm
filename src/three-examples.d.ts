declare module "three/examples/jsm/loaders/FBXLoader.js" {
    import type { Group } from "three";

    export class FBXLoader {
        parse(buffer: ArrayBuffer, path: string): Group;
    }
}

declare module "three/examples/jsm/exporters/GLTFExporter.js" {
    import type { Object3D } from "three";

    type GLTFExporterResult = ArrayBuffer | object;

    interface GLTFExporterOptions {
        binary?: boolean;
    }

    export class GLTFExporter {
        parse(
            input: Object3D | Object3D[],
            onDone: (result: GLTFExporterResult) => void,
            onError: (error: Error) => void,
            options?: GLTFExporterOptions,
        ): void;
    }
}
