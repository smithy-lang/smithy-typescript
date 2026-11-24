import { ShapeId } from "../../../model";
import { HttpRpcProtocolGenerator } from "../../integration/HttpRpcProtocolGenerator";
import type { GenerationContext } from "../../integration/ProtocolGenerator";
import { SmithyProtocolUtils } from "../SmithyProtocolUtils";

/**
 * Protocol generator for smithy.protocols#rpcv2Json.
 */
export class SmithyRpcV2Json extends HttpRpcProtocolGenerator {
  public getProtocol(): ShapeId {
    return ShapeId.from("smithy.protocols#rpcv2Json");
  }

  public generateProtocolTests(context: GenerationContext): void {
    SmithyProtocolUtils.generateProtocolTests(this, context);
  }
}
