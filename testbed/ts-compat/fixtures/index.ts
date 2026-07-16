/**
 * Type-compatibility fixture.
 *
 * One generated client per codegen variant is imported, instantiated, and used
 * to send a command. Nothing here is executed - the file exists purely so that
 * `tsc` type-checks the clients' published `.d.ts` surface (and their transitive
 * `@smithy` type dependencies) against each TypeScript version.
 *
 * smithy-typescript does not ship end-user SDK clients; the closest analog is the
 * generated protocol-test clients under `private/`. They exercise the full
 * `@smithy/*` type surface (client, commands, models, endpoints, retry, auth)
 * that downstream SDKs re-export, so compiling them is a good proxy for the
 * type-level compatibility of the packages themselves.
 *
 * Codegen coverage:
 *   - rpcv2Cbor, classic codegen -> @smithy/smithy-rpcv2-cbor
 *   - rpcv2Cbor, schema codegen  -> @smithy/smithy-rpcv2-cbor-schema
 *   - XYZService, classic codegen -> xyz            (private/my-local-model)
 *   - XYZService, schema codegen  -> xyz-schema     (private/my-local-model-schema)
 */
import { EmptyInputOutputCommand as RpcEmptyInputOutputCommand, RpcV2ProtocolClient } from "@smithy/smithy-rpcv2-cbor";
import {
  EmptyInputOutputCommand as RpcSchemaEmptyInputOutputCommand,
  RpcV2ProtocolClient as RpcV2ProtocolSchemaClient,
} from "@smithy/smithy-rpcv2-cbor-schema";
import { CamelCaseOperationCommand, XYZServiceClient } from "xyz";
import {
  CamelCaseOperationCommand as CamelCaseOperationSchemaCommand,
  XYZServiceClient as XYZServiceSchemaClient,
} from "xyz-schema";

// The generated clients require an endpoint (EndpointRequiredInputConfig).
const endpoint = "https://example.com";

// rpcv2Cbor - classic codegen
export async function rpcv2Cbor(): Promise<void> {
  const client = new RpcV2ProtocolClient({ endpoint });
  const output = await client.send(new RpcEmptyInputOutputCommand({}));
  void output.$metadata;
}

// rpcv2Cbor - schema codegen
export async function rpcv2CborSchema(): Promise<void> {
  const client = new RpcV2ProtocolSchemaClient({ endpoint });
  const output = await client.send(new RpcSchemaEmptyInputOutputCommand({}));
  void output.$metadata;
}

// XYZService - classic codegen
export async function xyz(): Promise<void> {
  const client = new XYZServiceClient({ endpoint });
  const output = await client.send(new CamelCaseOperationCommand({}));
  const token: string | undefined = output.token;
  void token;
}

// XYZService - schema codegen
export async function xyzSchema(): Promise<void> {
  const client = new XYZServiceSchemaClient({ endpoint });
  const output = await client.send(new CamelCaseOperationSchemaCommand({}));
  const token: string | undefined = output.token;
  void token;
}
