# Fbx2vrm

A TypeScript/JavaScript library and CLI for converting FBX files to VRM 1.0.

## Install

```bash
npm install fbx2vrm
```

## CLI usage

```bash
fbx2vrm convert path/to/input.fbx path/to/output.vrm
```

### CLI options

```bash
fbx2vrm convert <input.fbx> <output.vrm> [options]

Options:
  --confidence-threshold  Minimum confidence (0-1) required for mappings
  --llm-api-key           OpenAI API key (falls back to OPENAI_API_KEY)
  --llm-model             OpenAI model override
  --llm-base-url          OpenAI API base URL override
  --llm-temperature       OpenAI temperature (0-1)
  --llm-context           Extra context for LLM mapping
  --debug-json            Emit JSON output with mappings and warnings
```

Example with LLM assistance:

```bash
OPENAI_API_KEY=sk-... \
  fbx2vrm convert input.fbx output.vrm \
  --confidence-threshold 0.6 \
  --llm-context "Character is a humanoid with standard naming"
```

## Library usage

```ts
import { convertFbxToVrm } from "fbx2vrm";

await convertFbxToVrm({
  inputPath: "./assets/input.fbx",
  outputPath: "./output.vrm",
  minimumConfidence: 0.5,
  meta: {
    name: "Example Avatar",
    version: "1.0",
  },
});
```

### Optional LLM resolver

The conversion pipeline can ask an LLM to fill missing mappings when bone
heuristics are inconclusive.

```ts
import { convertFbxToVrm, createOpenAiResolver } from "fbx2vrm";

const llmResolver = createOpenAiResolver({
  apiKey: process.env.OPENAI_API_KEY ?? "",
  model: "gpt-4.1",
});

await convertFbxToVrm({
  inputPath: "./assets/input.fbx",
  outputPath: "./output.vrm",
  minimumConfidence: 0.65,
  llmResolver,
  llmContext: "Character uses Mixamo-style bone naming",
});
```

## Development

```bash
npm run lint
npm test
```
