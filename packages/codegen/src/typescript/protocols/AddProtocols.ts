import type { ProtocolGenerator } from "../integration/ProtocolGenerator";
import { TypeScriptIntegration } from "../integration/TypeScriptIntegration";
import { SmithyRpcV2Cbor } from "./cbor/SmithyRpcV2Cbor";
import { SmithyRpcV2Json } from "./json/SmithyRpcV2Json";

/**
 * Registers the Smithy RPC v2 protocol generators.
 */
export class AddProtocols extends TypeScriptIntegration {
  public getProtocolGenerators(): ProtocolGenerator[] {
    return [new SmithyRpcV2Cbor(), new SmithyRpcV2Json()];
  }
}
