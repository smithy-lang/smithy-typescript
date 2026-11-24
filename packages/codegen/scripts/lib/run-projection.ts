import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

// oxlint-disable-next-line no-restricted-imports -- the dev loop runs the package from source
import { SmithyTsCodegen } from "../../src";
import { type DiffSummary, writeDiffReport } from "./diff-report";
import { postProcessPackage } from "./post-process";

const REPO_ROOT = resolve(__dirname, "../../../..");

export interface ProjectionRun {
  projection: string;
  summary: DiffSummary;
  outputDir: string;
}

/** Generates one projection of the protocol test build into private-js and diffs it against private. */
export async function runProjection(projection: string, fixtureDir: string): Promise<ProjectionRun> {
  const smithyBuildConfig = JSON.parse(
    readFileSync(join(REPO_ROOT, "smithy-typescript-protocol-test-codegen/smithy-build.json"), "utf-8")
  );
  const model = readFileSync(join(fixtureDir, "model.json"), "utf-8");

  const outputDir = join(REPO_ROOT, "private-js", projection);
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const codegen = new SmithyTsCodegen({ smithyBuildConfig, model, projection });
  await codegen.writeToPath(outputDir);
  postProcessPackage(outputDir);

  const summary = writeDiffReport(join(REPO_ROOT, "private", projection), outputDir);
  return { projection, summary, outputDir };
}
