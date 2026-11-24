import type { SymbolProvider } from "../../codegen-core";
import { type Model, type ServiceShape, ServiceIndex } from "../../model";
import { LanguageTarget } from "../LanguageTarget";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import { AddEventStreamDependency } from "./AddEventStreamDependency";
import { TypeScriptIntegration } from "./TypeScriptIntegration";

const requiresHttp2ForEventStreams = (model: Model, service: ServiceShape): boolean => {
  for (const protocolId of ServiceIndex.of(model).getProtocols(service).keys()) {
    const protocolTrait = service.findTrait(protocolId);
    if (protocolTrait === undefined) {
      continue;
    }
    const node = protocolTrait.toNode();
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      continue;
    }
    const eventStreamHttp = (node as Record<string, unknown>).eventStreamHttp;
    if (Array.isArray(eventStreamHttp) && eventStreamHttp.includes("h2")) {
      return true;
    }
  }
  return false;
};

/**
 * Switches the Node request handler to HTTP/2 for event stream protocols that need it.
 */
export class AddHttp2Dependency extends TypeScriptIntegration {
  public runAfter(): string[] {
    return [new AddEventStreamDependency().name()];
  }

  public getRuntimeConfigWriters(
    settings: TypeScriptSettings,
    model: Model,
    _symbolProvider: SymbolProvider,
    target: LanguageTarget
  ): Map<string, (writer: TypeScriptWriter) => void> {
    if (!requiresHttp2ForEventStreams(model, settings.getService(model)) || target !== LanguageTarget.NODE) {
      return new Map();
    }
    return new Map([
      [
        "requestHandler",
        (writer) => {
          writer.addImport("NodeHttp2Handler", "RequestHandler", TypeScriptDependency.AWS_SDK_NODE_HTTP_HANDLER);
          writer.openBlock("RequestHandler.create(config?.requestHandler ?? (async () => ({", "})))", () => {
            writer.write("...await defaultConfigProvider(),");
            writer.write("disableConcurrentStreams: true");
          });
        },
      ],
    ]);
  }
}
