import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertFbxToVrm } from "../api/convert.js";
import { createOpenAiResolver } from "../mapping/llmResolver.js";

export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const HELP_TEXT = `fbx2vrm

Usage:
  fbx2vrm convert <input.fbx> <output.vrm>

Options:
  -h, --help                Show help information
  --confidence-threshold    Minimum confidence (0-1) required for mappings
  --llm-api-key             OpenAI API key (falls back to OPENAI_API_KEY)
  --llm-model               OpenAI model override
  --llm-base-url            OpenAI API base URL override
  --llm-temperature         OpenAI temperature (0-1)
  --llm-context             Extra context for LLM mapping
  --debug-json              Emit JSON output with mappings and warnings
`;

export type CliDependencies = {
  convert?: typeof convertFbxToVrm;
  createResolver?: typeof createOpenAiResolver;
  env?: NodeJS.ProcessEnv;
};

type ConvertArgs = {
  inputPath: string;
  outputPath: string;
  minimumConfidence: number;
  debugJson: boolean;
  llm: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    temperature?: number;
    context?: string;
  };
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const parseNumberOption = (
  value: string | undefined,
  optionName: string,
): ParseResult<number> => {
  if (!value) {
    return { ok: false, error: `Missing value for ${optionName}.` };
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return { ok: false, error: `Invalid number for ${optionName}.` };
  }
  return { ok: true, value: parsed };
};

const parseConvertArgs = (args: string[]): ParseResult<ConvertArgs> => {
  if (args.length < 2) {
    return {
      ok: false,
      error: "convert requires <input.fbx> and <output.vrm> arguments.",
    };
  }

  const [inputPath, outputPath, ...rest] = args;
  const llm = {
    apiKey: undefined as string | undefined,
    model: undefined as string | undefined,
    baseUrl: undefined as string | undefined,
    temperature: undefined as number | undefined,
    context: undefined as string | undefined,
  };
  let minimumConfidence = 0.5;
  let debugJson = false;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg) {
      continue;
    }

    switch (arg) {
      case "--confidence-threshold": {
        const parsed = parseNumberOption(rest[index + 1], arg);
        if (!parsed.ok) {
          return parsed;
        }
        minimumConfidence = parsed.value;
        index += 1;
        break;
      }
      case "--llm-api-key":
        llm.apiKey = rest[index + 1];
        index += 1;
        break;
      case "--llm-model":
        llm.model = rest[index + 1];
        index += 1;
        break;
      case "--llm-base-url":
        llm.baseUrl = rest[index + 1];
        index += 1;
        break;
      case "--llm-temperature": {
        const parsed = parseNumberOption(rest[index + 1], arg);
        if (!parsed.ok) {
          return parsed;
        }
        llm.temperature = parsed.value;
        index += 1;
        break;
      }
      case "--llm-context":
        llm.context = rest[index + 1];
        index += 1;
        break;
      case "--debug-json":
        debugJson = true;
        break;
      default:
        if (arg.startsWith("-")) {
          return { ok: false, error: `Unknown option: ${arg}.` };
        }
        return { ok: false, error: `Unexpected argument: ${arg}.` };
    }
  }

  if (minimumConfidence < 0 || minimumConfidence > 1) {
    return {
      ok: false,
      error: "Confidence threshold must be between 0 and 1.",
    };
  }

  if (
    llm.temperature !== undefined &&
    (llm.temperature < 0 || llm.temperature > 1)
  ) {
    return {
      ok: false,
      error: "LLM temperature must be between 0 and 1.",
    };
  }

  return {
    ok: true,
    value: {
      inputPath,
      outputPath,
      minimumConfidence,
      debugJson,
      llm,
    },
  };
};

const formatWarnings = (warnings: string[]): string =>
  warnings.map((warning) => `- ${warning}`).join("\n");

export const runCli = async (
  args: string[],
  dependencies: CliDependencies = {},
): Promise<CliResult> => {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return {
      exitCode: 0,
      stdout: HELP_TEXT,
      stderr: "",
    };
  }

  const [command, ...rest] = args;
  if (command !== "convert") {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Unknown command: ${command}.`,
    };
  }

  const parsed = parseConvertArgs(rest);
  if (!parsed.ok) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: parsed.error,
    };
  }

  const env = dependencies.env ?? process.env;
  const convert = dependencies.convert ?? convertFbxToVrm;
  const createResolver = dependencies.createResolver ?? createOpenAiResolver;
  const llmApiKey = parsed.value.llm.apiKey ?? env.OPENAI_API_KEY;
  const useLlm =
    Boolean(parsed.value.llm.apiKey) ||
    Boolean(parsed.value.llm.model) ||
    Boolean(parsed.value.llm.baseUrl) ||
    typeof parsed.value.llm.temperature === "number" ||
    Boolean(parsed.value.llm.context) ||
    Boolean(env.OPENAI_API_KEY);

  if (useLlm && !llmApiKey) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "LLM requested but no API key provided.",
    };
  }

  try {
    const llmResolver =
      useLlm && llmApiKey
        ? createResolver({
            apiKey: llmApiKey,
            model: parsed.value.llm.model,
            baseUrl: parsed.value.llm.baseUrl,
            temperature: parsed.value.llm.temperature,
          })
        : undefined;

    const result = await convert({
      inputPath: parsed.value.inputPath,
      outputPath: parsed.value.outputPath,
      minimumConfidence: parsed.value.minimumConfidence,
      llmResolver,
      llmContext: parsed.value.llm.context,
    });

    if (parsed.value.debugJson) {
      const debugResult = { ...result, vrm: undefined };
      return {
        exitCode: 0,
        stdout: JSON.stringify(
          {
            inputPath: parsed.value.inputPath,
            outputPath: parsed.value.outputPath,
            ...debugResult,
          },
          null,
          2,
        ),
        stderr: "",
      };
    }

    const warningText =
      result.warnings.length > 0 ? formatWarnings(result.warnings) : "";
    return {
      exitCode: 0,
      stdout: `Converted ${parsed.value.inputPath} → ${parsed.value.outputPath}`,
      stderr: warningText,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      stdout: "",
      stderr: message,
    };
  }
};

const entryPath = process.argv[1];
const isDirectRun =
  entryPath !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(entryPath);

if (isDirectRun) {
  const result = await runCli(process.argv.slice(2));
  if (result.stdout) {
    console.log(result.stdout);
  }
  if (result.stderr) {
    console.error(result.stderr);
  }
  process.exitCode = result.exitCode;
}
