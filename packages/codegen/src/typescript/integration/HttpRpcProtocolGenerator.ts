import { ApplicationProtocol } from "../ApplicationProtocol";
import { ProtocolGenerator } from "./ProtocolGenerator";

/**
 * Base class for HTTP RPC protocols. Only the schema-based path is ported.
 *
 * @internal
 */
export abstract class HttpRpcProtocolGenerator extends ProtocolGenerator {
  private static readonly _APPLICATION_PROTOCOL = ApplicationProtocol.createDefaultHttpApplicationProtocol();

  public getApplicationProtocol(): ApplicationProtocol {
    return HttpRpcProtocolGenerator._APPLICATION_PROTOCOL;
  }
}
