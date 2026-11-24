import type { HttpMessageTestCase, OperationShape, ServiceShape } from "../../model";
import { HttpProtocolTestGenerator } from "../HttpProtocolTestGenerator";
import type { GenerationContext, ProtocolGenerator } from "../integration/ProtocolGenerator";
import type { TypeScriptSettings } from "../TypeScriptSettings";

const SCHEMA_ERROR_TESTS = new Set([
  "RpcV2CborInvalidGreetingError",
  "RpcV2CborComplexError",
  "RpcV2CborEmptyComplexError",
]);

/**
 * Shared helpers for the Smithy RPC protocol generators.
 */
export class SmithyProtocolUtils {
  public static generateProtocolTests(generator: ProtocolGenerator, context: GenerationContext): void {
    new HttpProtocolTestGenerator(context, generator, SmithyProtocolUtils._filterProtocolTests).run();
  }

  private static _filterProtocolTests(
    _service: ServiceShape,
    _operation: OperationShape,
    testCase: HttpMessageTestCase,
    settings: TypeScriptSettings
  ): boolean {
    if (testCase.getTags().includes("defaults")) {
      return true;
    }
    return settings.generateSchemas() && SCHEMA_ERROR_TESTS.has(testCase.getId());
  }
}
