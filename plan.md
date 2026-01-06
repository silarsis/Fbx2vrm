# Implementation Plan: FBX → VRM 1.0 Conversion Library

## Status
- Step 1 (Project setup + tooling) completed with initial scaffolding, TypeScript config, testing, linting, and CLI entry point scaffold.

## Step 1: Project Setup
- Initialize Node.js project structure.
- Add TypeScript config.
- Install core dependencies: three, @pixiv/three-vrm.
- Add CLI entry point scaffolding.

## Step 2: FBX Loader
- Implement `loaders/fbxLoader.ts` using FBXLoader.
- Normalize skeleton extraction and mesh binding info.
- Add tests for FBX loading (using stubbed skeleton data until assets arrive).

## Step 3: Bone Mapping Heuristics
- Implement `mapping/boneMap.ts`.
- Add name normalization + synonym matching.
- Add structural and spatial heuristics.
- Add confidence scoring in `mapping/confidence.ts`.
- Unit tests for each heuristic and confidence scoring.

## Step 4: Optional LLM Resolver
- Implement `mapping/llmResolver.ts` with a pluggable interface.
- Provide default OpenAI connector.
- Add validation for LLM responses.
- Add tests for LLM integration logic using mocks.

## Step 5: VRM Builder
- Implement `vrm/vrmBuilder.ts` using @pixiv/three-vrm.
- Apply bone mapping to VRMHumanoid.
- Export VRM file.
- Add tests to verify output structure.

## Step 6: Conversion Pipeline
- Implement `api/convert.ts` orchestrating the pipeline.
- Produce `ConversionResult` with warnings and confidence metadata.
- Add integration tests with fixture models (when available).

## Step 7: CLI
- Implement `cli/index.ts` with `convert` command.
- Add options for LLM and confidence threshold.
- Add debug JSON output.
- Add tests for CLI argument parsing.

## Step 8: Documentation
- Write README usage examples.
- Provide usage documentation for both library and CLI.

## Step 9: Test Assets Integration
- Add provided FBX test fixtures.
- Add integration tests using real assets.
