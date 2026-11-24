import type { SymbolProvider } from "../codegen-core";
import { DocumentationTrait, type Model, PaginatedTrait, ServiceShape, TopDownIndex, WaitableTrait } from "../model";
import type { ProtocolGenerator } from "./integration/ProtocolGenerator";
import { ProtocolGenerator as ProtocolGeneratorStatics } from "./integration/ProtocolGenerator";
import { SchemaGenerationAllowlist } from "./schema/SchemaGenerationAllowlist";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import type { TypeScriptWriter } from "./TypeScriptWriter";
import { replaceLast } from "./validation/ReplaceLast";

/**
 * Writes the package entry point.
 */
export class IndexGenerator {
  private constructor() {}

  public static writeIndex(
    settings: TypeScriptSettings,
    model: Model,
    symbolProvider: SymbolProvider,
    protocolGenerator: ProtocolGenerator | undefined,
    writer: TypeScriptWriter,
    modelIndexer: TypeScriptWriter
  ): void {
    writer.write("/* eslint-disable */");
    const serviceId = settings.getOptionalService();
    if (serviceId !== undefined) {
      const documentation = (model.expectShape(serviceId, ServiceShape) as ServiceShape).getTrait(DocumentationTrait);
      if (documentation !== undefined) {
        writer.writeDocs(documentation.getValue() + "\n\n" + "@packageDocumentation");
      }
    }
    if (settings.generateClient()) {
      IndexGenerator._writeClientExports(settings, model, symbolProvider, writer);
    }
    const schemaMode = SchemaGenerationAllowlist.allows(serviceId, settings);
    if (settings.generateServerSdk()) {
      if (schemaMode) {
        writer.write('export * from "./server/$LHandler";', settings.getService(model).getId().getName());
      } else if (protocolGenerator !== undefined) {
        IndexGenerator._writeProtocolExports(protocolGenerator, writer);
        writer.write('export * from "./server/index";');
      }
    }
    if (schemaMode) {
      writer.write('export * from "./schemas/schemas_0";');
    }
    writer.write(modelIndexer.toString().replace("// smithy-typescript generated code", ""));
  }

  private static _writeProtocolExports(protocolGenerator: ProtocolGenerator, writer: TypeScriptWriter): void {
    const protocolName = ProtocolGeneratorStatics.getSanitizedName(protocolGenerator.getName());
    writer.write('export * as $L from "./protocols/$L";', protocolName, protocolName);
  }

  private static _writeClientExports(
    settings: TypeScriptSettings,
    model: Model,
    symbolProvider: SymbolProvider,
    writer: TypeScriptWriter
  ): void {
    const service = settings.getService(model);
    const symbol = symbolProvider.toSymbol(service);
    const normalizedClientName = replaceLast(symbol.getName(), "Client", "");
    writer.write('export * from "./$L";', symbol.getName());
    writer.write('export * from "./$L";', normalizedClientName);
    writer.write('export type { ClientInputEndpointParameters } from "./endpoint/EndpointParameters";');
    writer.write('export type { RuntimeExtension } from "./runtimeExtensions";');
    writer.write('export type { $LExtensionConfiguration } from "./extensionConfiguration";', normalizedClientName);
    writer.write('export * from "./commands";');
    writer.write('export { Command as $$Command } from "@smithy/core/client";');
    const operations = TopDownIndex.of(model).getContainedOperations(service);
    if (operations.some((operation) => operation.hasTrait(PaginatedTrait))) {
      writer.write('export * from "./pagination";');
    }
    if (operations.some((operation) => operation.hasTrait(WaitableTrait))) {
      writer.write('export * from "./waiters";');
    }
  }
}
