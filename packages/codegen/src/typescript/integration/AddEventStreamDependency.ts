import { CodeInterceptor, type SymbolProvider } from "../../codegen-core";
import { EventStreamIndex, type Model, type ServiceShape, TopDownIndex } from "../../model";
import { LanguageTarget } from "../LanguageTarget";
import { SmithyContextCodeSection } from "../sections/SmithyContextCodeSection";
import { SmithyCoreSubmodules } from "../SmithyCoreSubmodules";
import type { TypeScriptCodegenContext } from "../TypeScriptCodegenContext";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import { AddBuiltinPlugins } from "./AddBuiltinPlugins";
import { RuntimeClientPlugin } from "./RuntimeClientPlugin";
import { TypeScriptIntegration } from "./TypeScriptIntegration";

const hasEventStream = (model: Model, service: ServiceShape): boolean => {
  const eventStreamIndex = EventStreamIndex.of(model);
  return TopDownIndex.of(model)
    .getContainedOperations(service)
    .some(
      (operation) =>
        eventStreamIndex.getInputInfo(operation) !== undefined ||
        eventStreamIndex.getOutputInfo(operation) !== undefined
    );
};

const eventStreamSerdeProviderWriter = (writer: TypeScriptWriter): void => {
  writer.addDependency(TypeScriptDependency.SMITHY_CORE);
  writer.addImportSubmodule(
    "eventStreamSerdeProvider",
    null,
    TypeScriptDependency.SMITHY_CORE,
    SmithyCoreSubmodules.EVENT_STREAMS
  );
  writer.write("eventStreamSerdeProvider");
};

/**
 * Adds event stream serde support to clients of services with event streams.
 */
export class AddEventStreamDependency extends TypeScriptIntegration {
  public runAfter(): string[] {
    return [new AddBuiltinPlugins().name()];
  }

  public getClientPlugins(): RuntimeClientPlugin[] {
    return [
      RuntimeClientPlugin.builder()
        .withConventions(
          "@smithy/core/event-streams",
          TypeScriptDependency.SMITHY_CORE.dependency.getVersion(),
          "EventStreamSerde",
          "HAS_CONFIG"
        )
        .servicePredicate(hasEventStream)
        .build(),
    ];
  }

  public addConfigInterfaceFields(
    settings: TypeScriptSettings,
    model: Model,
    _symbolProvider: SymbolProvider,
    writer: TypeScriptWriter
  ): void {
    if (!hasEventStream(model, settings.getService(model))) {
      return;
    }
    writer.addDependency(TypeScriptDependency.SMITHY_CORE);
    writer.addTypeImport("EventStreamSerdeProvider", "__EventStreamSerdeProvider", TypeScriptDependency.SMITHY_TYPES);
    writer.writeDocs("The function that provides necessary utilities for generating and parsing event stream");
    writer.write("eventStreamSerdeProvider?: __EventStreamSerdeProvider;\n");
  }

  public getRuntimeConfigWriters(
    settings: TypeScriptSettings,
    model: Model,
    _symbolProvider: SymbolProvider,
    target: LanguageTarget
  ): Map<string, (writer: TypeScriptWriter) => void> {
    if (!hasEventStream(model, settings.getService(model))) {
      return new Map();
    }
    if (target === LanguageTarget.NODE || target === LanguageTarget.BROWSER) {
      return new Map([["eventStreamSerdeProvider", eventStreamSerdeProviderWriter]]);
    }
    return new Map();
  }

  public interceptors(_codegenContext: TypeScriptCodegenContext) {
    return [
      CodeInterceptor.appender<SmithyContextCodeSection, TypeScriptWriter>(SmithyContextCodeSection, (w, s) => {
        const eventStreamIndex = EventStreamIndex.of(s.getModel());
        const input = eventStreamIndex.getInputInfo(s.getOperation()) !== undefined;
        const output = eventStreamIndex.getOutputInfo(s.getOperation()) !== undefined;
        if (!input && !output) {
          return;
        }
        w.write("").indent();
        w.writeDocs("@internal");
        w.openBlock("eventStream: {", "},", () => {
          if (input) {
            w.write("input: true,");
          }
          if (output) {
            w.write("output: true,");
          }
        });
        w.dedent();
      }),
    ];
  }
}
