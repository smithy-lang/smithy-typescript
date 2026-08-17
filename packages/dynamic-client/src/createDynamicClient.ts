import { SmithyRpcV2CborProtocol } from "@smithy/core/cbor";
import { createAggregatedClient } from "@smithy/core/client";
import type { RuntimeTypecheckOptions } from "@smithy/typecheck";
import { hasOwn } from "@smithy/core/serde";

import { ModelIndex, parseShapeId } from "./ast/ModelIndex";
import type { SmithyAst } from "./ast/types";
import { buildClient } from "./client/buildClient";
import { buildCommands } from "./command/buildCommands";
import { buildEndpointProvider } from "./endpoint/buildEndpointProvider";
import { selectProtocol } from "./protocol/selectProtocol";
import type { ClientProtocolCtor } from "./protocol/types";
import { SchemaBuilder } from "./schema/SchemaBuilder";

export type { ClientProtocolCtor };

/**
 * The runtime export surface produced from an AST. Mirrors the symbol export
 * surface of a code-generated schema-based client (types excepted): the client
 * class (keyed by `<Service>Client`), one `<Op>Command` constructor per
 * operation, and one `<Shape>$` static schema per named shape.
 *
 * @public
 */
export type DynamicClientExports = Record<string, unknown>;

/**
 * The default runtime typecheck behavior: log input and output mismatches as
 * warnings. This substitutes for the absent compile-time type safety.
 *
 * @internal
 */
const DEFAULT_TYPECHECK: RuntimeTypecheckOptions = { input: "warn", output: "warn" };

/**
 * Converts a Smithy JSON AST into a runtime schema-based client.
 *
 * The returned object mirrors the export surface of a generated client. The
 * protocol is selected from the service's protocol traits, choosing from the
 * supplied `protocols` list (default: the in-repo RPCv2 CBOR protocol). A
 * higher-level factory can wrap this function with a larger `protocols` array
 * to support additional protocols.
 *
 * Because no static types are produced, a runtime typecheck (RTTC) middleware
 * is installed automatically to validate inputs and outputs against the
 * schemas. Defaults to logging mismatches as warnings; pass
 * `{ input: false, output: false }` to disable, or a logger channel / `"throw"`
 * to change severity.
 *
 * @param ast - the Smithy JSON AST.
 * @param protocols - candidate client protocol constructors, in caller
 *   preference order.
 * @param typecheck - runtime typecheck behavior.
 *
 * @public
 */
export function createDynamicClient(
  ast: SmithyAst,
  protocols: ClientProtocolCtor[] = [SmithyRpcV2CborProtocol as ClientProtocolCtor],
  typecheck: RuntimeTypecheckOptions = DEFAULT_TYPECHECK
): DynamicClientExports {
  const index = new ModelIndex(ast);
  const { name: serviceName } = parseShapeId(index.getServiceId());
  const clientName = `${serviceName}Client`;

  const built = new SchemaBuilder(index).build();
  const { protocol, protocolSettings } = selectProtocol(index, protocols, built.errorTypeRegistries);
  const endpointProvider = buildEndpointProvider(index.getService());

  const commands = buildCommands(serviceName, clientName, built.operations, index.getOperationIds());

  const ClientClass = buildClient({ protocol, protocolSettings, endpointProvider, typecheck });
  createAggregatedClient(commands, ClientClass as any);

  const exports: DynamicClientExports = {
    [clientName]: ClientClass,
  };
  for (const commandName in commands) {
    if (!hasOwn(commands, commandName)) continue;
    exports[commandName] = commands[commandName];
  }
  for (const schemaSymbol in built.schemas) {
    if (!hasOwn(built.schemas, schemaSymbol)) continue;
    exports[schemaSymbol] = built.schemas[schemaSymbol];
  }
  for (const operationSymbol in built.operations) {
    if (!hasOwn(built.operations, operationSymbol)) continue;
    exports[operationSymbol] = built.operations[operationSymbol];
  }

  return exports;
}
