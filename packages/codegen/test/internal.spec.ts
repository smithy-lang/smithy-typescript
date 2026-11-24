import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, describe, expect, test } from "vitest";

// oxlint-disable-next-line no-restricted-imports -- the tests run the package from source
import { SmithyTsCodegen } from "../src";
import { type TypeScriptCodegenContext, TypeScriptIntegration } from "../src/submodules/internal";

const REPO_ROOT = resolve(__dirname, "../../..");

describe("internal submodule", () => {
  const out = mkdtempSync(join(tmpdir(), "smithy-codegen-internal-"));
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  test("lets a downstream integration add files through the delegator", async () => {
    class AddMarkerFile extends TypeScriptIntegration {
      public customize(context: TypeScriptCodegenContext): void {
        context.writerDelegator().useFileWriter("src/marker.ts", (writer) => {
          writer.write("export const marker = $S;", context.settings().getService(context.model()).getId().getName());
        });
      }
    }

    const smithyBuildConfig = JSON.parse(
      readFileSync(join(REPO_ROOT, "smithy-typescript-protocol-test-codegen/smithy-build.json"), "utf-8")
    );
    const model = JSON.parse(readFileSync(join(__dirname, "fixtures/my-local-model-schema/model.json"), "utf-8"));

    await new SmithyTsCodegen({ smithyBuildConfig, model, projection: "my-local-model-schema" })
      .addIntegration(new AddMarkerFile())
      .writeToPath(out);

    expect(readFileSync(join(out, "src/marker.ts"), "utf-8")).toContain('export const marker = "XYZService";');
  });
});
