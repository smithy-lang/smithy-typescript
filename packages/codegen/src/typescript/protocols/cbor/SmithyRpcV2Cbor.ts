import { ShapeId } from "../../../model";
import { HttpRpcProtocolGenerator } from "../../integration/HttpRpcProtocolGenerator";
import type { GenerationContext } from "../../integration/ProtocolGenerator";
import { SmithyProtocolUtils } from "../SmithyProtocolUtils";

/**
 * Protocol generator for smithy.protocols#rpcv2Cbor.
 */
export class SmithyRpcV2Cbor extends HttpRpcProtocolGenerator {
  public getProtocol(): ShapeId {
    return ShapeId.from("smithy.protocols#rpcv2Cbor");
  }

  public generateProtocolTests(context: GenerationContext): void {
    SmithyProtocolUtils.generateProtocolTests(this, context);
  }
}
