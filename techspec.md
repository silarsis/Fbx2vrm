# FBX → VRM 1.0 Conversion Library (Node.js)

## 1. Purpose
Design and implement a Node.js library and CLI that converts a rigged FBX model (e.g., from meshy.ai) into a valid VRM 1.0 file. The library will:

- Load and analyze a rigged FBX.
- Map the FBX bone hierarchy to VRM humanoid bones using heuristics.
- Optionally use an LLM to resolve ambiguous mappings.
- Emit a VRM 1.0 file with required humanoid bones and metadata.
- Return a structured result containing the output file path, bone mapping, confidence scores, and warnings.

## 2. Scope
### In Scope
- FBX loading and skeleton parsing.
- Heuristic bone mapping with confidence scoring.
- Optional LLM-assisted mapping (OpenAI default, pluggable interface).
- VRM 1.0 output using @pixiv/three-vrm.
- CLI + library API.
- Warnings and metadata output.

### Out of Scope (Initial Release)
- Blendshape / expression mapping beyond basic support.
- Physics (spring bones).
- Full material fidelity (basic conversion only).
- Retargeting/pose normalization.

## 3. Requirements
### Functional Requirements
1. Accept a rigged FBX file as input.
2. Produce a VRM 1.0 file as output.
3. Generate a bone mapping between FBX skeleton and VRM humanoid schema.
4. Provide confidence scores for each mapping.
5. Output warnings for low-confidence mappings.
6. Optionally query an LLM when confidence is below a threshold.
7. Provide a CLI that mirrors library functionality.

### Non-Functional Requirements
1. Node.js runtime only.
2. Pluggable LLM interface; default provider OpenAI.
3. Deterministic output when LLM is not used.
4. Clear error messages and warnings.
5. Maintainability and testability.

## 4. External Dependencies
### Core
- **three**: 3D scene/skeleton representation.
- **@pixiv/three-vrm**: VRM 1.0 assembly and export.

### FBX Loading
- **three/examples/jsm/loaders/FBXLoader** (preferred).
- Optional fallback: **fbx2gltf** (if loader limitations are found).

### LLM (Optional)
- **OpenAI API** (default connector).
- Pluggable interface for custom providers.

## 5. System Architecture
```
src/
  api/
    index.ts            # public API exports
    convert.ts          # high-level conversion pipeline
  cli/
    index.ts            # CLI entry
  loaders/
    fbxLoader.ts        # FBX loading and normalization
  mapping/
    boneMap.ts          # heuristic mapping
    confidence.ts       # confidence scoring
    llmResolver.ts      # LLM integration
  vrm/
    vrmBuilder.ts       # VRM assembly + export
  utils/
    io.ts
    logging.ts
    types.ts
```

## 6. Data Model
### Conversion Result
```ts
export type ConversionResult = {
  vrmFilePath: string;
  boneMap: Record<VrmHumanBoneName, string>;
  confidence: Record<VrmHumanBoneName, number>;
  warnings: string[];
  debug?: {
    llmUsed: boolean;
    candidates?: Record<string, unknown>;
  };
};
```

### LLM Interface
```ts
export type LlmProvider = {
  name: string;
  resolveMapping(input: LlmRequest): Promise<LlmResponse>;
};
```

## 7. Bone Mapping Strategy
### 7.1 Required VRM Bones
- hips
- spine
- chest
- upperChest (optional but recommended)
- neck
- head
- left/right: shoulder, upperArm, lowerArm, hand
- left/right: upperLeg, lowerLeg, foot

### 7.2 Heuristic Mapping
1. **Name Matching**
   - Normalize names (lowercase, strip separators).
   - Use synonyms and common naming conventions.
2. **Structure Matching**
   - Identify hips (root with branches).
   - Determine spine chain (hips → head).
   - Identify arm/leg branches.
3. **Spatial Rules**
   - Higher Y = head/neck.
   - Lower Y = legs/feet.
   - X sign indicates left vs right.
4. **Confidence Scoring**
   - Combine name match score + structural fit + symmetry.
   - Score per bone: 0–1.

### 7.3 LLM-Assisted Mapping
- Triggered when confidence < threshold.
- Provide skeleton summary JSON to LLM.
- LLM returns structured mapping JSON.
- Validate mapping against known bones.

## 8. CLI Specification
### Command
```
fbx2vrm convert <input.fbx> --out <output.vrm>
```

### Options
- `--llm-provider openai|custom`
- `--llm-api-key <key>`
- `--confidence-threshold <0..1>`
- `--debug-json <path>`

### Output
- Writes VRM file.
- Prints warnings/confidence table.
- Optional JSON report.

## 9. Library API
```ts
import { convertFbxToVrm } from "fbx2vrm";

const result = await convertFbxToVrm({
  inputPath: "model.fbx",
  outputPath: "model.vrm",
  llm: {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
  },
  confidenceThreshold: 0.6,
});
```

## 10. Error Handling
- If required bones cannot be identified: emit warnings and map best guess.
- If LLM fails: fallback to heuristics.
- If FBX loading fails: return error and exit non-zero from CLI.

## 11. Testing Strategy
### Unit Tests
- Name normalization and synonyms.
- Heuristic mapping with synthetic skeletons.
- Confidence scoring.
- LLM response validation.

### Integration Tests
- Convert known FBX fixtures to VRM.
- Validate VRM output structure (humanoid mapping present).

## 12. Future Enhancements
- Blendshape and expression mapping.
- Spring bones/physics.
- More robust material conversion.
- Full retargeting support.
