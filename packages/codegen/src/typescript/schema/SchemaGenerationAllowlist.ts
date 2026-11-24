import type { ShapeId } from "../../model";
import type { TypeScriptSettings } from "../TypeScriptSettings";

const ALLOWED = new Set<string>([
  "smithy.protocoltests.rpcv2Cbor#RpcV2Protocol",
  "smithy.protocoltests.rpcv2Json#RpcV2JsonProtocol",
  "org.xyz.v1#XYZService",
]);
const PROTOCOLS = new Set<string>(["smithy.protocols#rpcv2Cbor", "smithy.protocols#rpcv2Json"]);

/**
 * Selects the services and protocols that generate schema-based serde.
 */
export abstract class SchemaGenerationAllowlist {
  public static allows(serviceShapeId: ShapeId | undefined, settings: TypeScriptSettings): boolean {
    if (settings.isTypesOnly()) {
      return settings.generateSchemas();
    }
    if (serviceShapeId === undefined) {
      return false;
    }
    const protocol = settings.getProtocol();
    const allowedByProtocol = protocol !== undefined && PROTOCOLS.has(protocol.toString());
    const allowedByName = ALLOWED.has(serviceShapeId.toString());
    const clientAllowed =
      settings.generateClient() && settings.generateSchemas() && (allowedByProtocol || allowedByName);
    const serverAllowed = settings.generateServerSdk() && settings.generateServerSchemas();
    return clientAllowed || serverAllowed;
  }
}
