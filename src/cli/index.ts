import path from "node:path";
import { fileURLToPath } from "node:url";

export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const HELP_TEXT = `fbx2vrm (scaffold)

Usage:
  fbx2vrm convert <input.fbx> <output.vrm>

Options:
  -h, --help     Show help information
`;

export const runCli = (args: string[]): CliResult => {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return {
      exitCode: 0,
      stdout: HELP_TEXT,
      stderr: "",
    };
  }

  return {
    exitCode: 1,
    stdout: "",
    stderr: "CLI scaffold only: command not implemented yet.",
  };
};

const entryPath = process.argv[1];
const isDirectRun =
  entryPath !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(entryPath);

if (isDirectRun) {
  const result = runCli(process.argv.slice(2));
  if (result.stdout) {
    console.log(result.stdout);
  }
  if (result.stderr) {
    console.error(result.stderr);
  }
  process.exitCode = result.exitCode;
}
