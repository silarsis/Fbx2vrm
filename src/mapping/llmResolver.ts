import type { FbxSkeletonInfo } from "../loaders/fbxLoader.js";
import { vrmHumanoidBoneNames } from "./boneMap.js";

export type LlmMappingSuggestion = {
  target: (typeof vrmHumanoidBoneNames)[number];
  source: string | null;
  confidence?: number;
  reasoning?: string;
};

export type LlmResolverRequest = {
  skeleton: FbxSkeletonInfo;
  targets?: (typeof vrmHumanoidBoneNames)[number][];
  context?: string;
};

export type LlmResolverResult = {
  mappings: LlmMappingSuggestion[];
  warnings: string[];
  model?: string;
  raw?: unknown;
};

export type LlmResolver = (
  request: LlmResolverRequest,
) => Promise<LlmResolverResult>;

export type LlmValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  mappings: LlmMappingSuggestion[];
};

const extractJsonPayload = (content: string): string => {
  const match = content.match(/```json\s*([\s\S]*?)\s*```/i);
  if (match) {
    return match[1].trim();
  }
  return content.trim();
};

const normalizeTargets = (
  targets?: (typeof vrmHumanoidBoneNames)[number][],
): (typeof vrmHumanoidBoneNames)[number][] => targets ?? [...vrmHumanoidBoneNames];

export const validateLlmResponse = (
  payload: unknown,
  skeleton: FbxSkeletonInfo,
  targets?: (typeof vrmHumanoidBoneNames)[number][],
): LlmValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolvedTargets = normalizeTargets(targets);
  const targetSet = new Set(resolvedTargets);
  const boneNames = new Set(skeleton.bones.map((bone) => bone.name));

  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: ["Response is not an object"], warnings, mappings: [] };
  }

  const payloadRecord = payload as { mappings?: unknown };
  if (!Array.isArray(payloadRecord.mappings)) {
    return {
      valid: false,
      errors: ["Response is missing a mappings array"],
      warnings,
      mappings: [],
    };
  }

  const seenTargets = new Set<string>();
  const seenSources = new Set<string>();
  const mappings: LlmMappingSuggestion[] = [];

  for (const entry of payloadRecord.mappings) {
    if (!entry || typeof entry !== "object") {
      errors.push("Mapping entry is not an object");
      continue;
    }

    const mapping = entry as Partial<LlmMappingSuggestion>;
    if (!mapping.target || typeof mapping.target !== "string") {
      errors.push("Mapping entry missing target");
      continue;
    }

    if (!targetSet.has(mapping.target)) {
      errors.push(`Unknown target: ${mapping.target}`);
      continue;
    }

    if (seenTargets.has(mapping.target)) {
      errors.push(`Duplicate target mapping for ${mapping.target}`);
      continue;
    }

    const source = mapping.source ?? null;
    if (source !== null && typeof source !== "string") {
      errors.push(`Invalid source for target ${mapping.target}`);
      continue;
    }

    if (source && !boneNames.has(source)) {
      errors.push(`Unknown source bone ${source} for target ${mapping.target}`);
      continue;
    }

    if (typeof mapping.confidence !== "undefined") {
      if (typeof mapping.confidence !== "number") {
        errors.push(`Confidence for ${mapping.target} is not a number`);
        continue;
      }
      if (mapping.confidence < 0 || mapping.confidence > 1) {
        errors.push(`Confidence for ${mapping.target} must be between 0 and 1`);
        continue;
      }
    }

    if (source) {
      if (seenSources.has(source)) {
        warnings.push(`Source bone ${source} mapped more than once`);
      } else {
        seenSources.add(source);
      }
    }

    seenTargets.add(mapping.target);
    mappings.push({
      target: mapping.target,
      source,
      confidence: mapping.confidence,
      reasoning: mapping.reasoning,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    mappings,
  };
};

export type OpenAiResolverOptions = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
};

const buildPrompt = (
  skeleton: FbxSkeletonInfo,
  targets: (typeof vrmHumanoidBoneNames)[number][],
  context?: string,
): string => {
  const bones = skeleton.bones.map((bone) => bone.name);
  const payload = {
    instruction:
      "Map the provided source skeleton bones to VRM humanoid target bones.",
    targets,
    sourceBones: bones,
    responseFormat:
      "Return JSON with { mappings: [{ target, source, confidence, reasoning }] }.",
    context,
  };
  return JSON.stringify(payload, null, 2);
};

export const createOpenAiResolver = (
  options: OpenAiResolverOptions,
): LlmResolver => {
  const model = options.model ?? "gpt-4o-mini";
  const baseUrl = options.baseUrl ?? "https://api.openai.com/v1/chat/completions";
  const temperature = options.temperature ?? 0.2;

  return async (request: LlmResolverRequest): Promise<LlmResolverResult> => {
    const targets = normalizeTargets(request.targets);
    const prompt = buildPrompt(request.skeleton, targets, request.context);

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          {
            role: "system",
            content:
              "You are a bone mapping assistant. Reply only with JSON, no prose.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI response missing content");
    }

    const parsed = JSON.parse(extractJsonPayload(content));
    const validation = validateLlmResponse(parsed, request.skeleton, targets);
    if (!validation.valid) {
      throw new Error(`Invalid LLM response: ${validation.errors.join("; ")}`);
    }

    return {
      mappings: validation.mappings,
      warnings: validation.warnings,
      model: data.model ?? model,
      raw: parsed,
    };
  };
};

export const resolveWithLlm = async (
  resolver: LlmResolver,
  request: LlmResolverRequest,
): Promise<LlmResolverResult> => resolver(request);
