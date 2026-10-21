// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { RpcV2JsonListInputOutput } from "../models/models_0";
import { RpcV2JsonLists$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link RpcV2JsonListsCommand}.
 */
export interface RpcV2JsonListsCommandInput extends RpcV2JsonListInputOutput {}
/**
 * @public
 *
 * The output of {@link RpcV2JsonListsCommand}.
 */
export interface RpcV2JsonListsCommandOutput extends RpcV2JsonListInputOutput, __MetadataBearer {}

/**
 * This test case serializes JSON lists for the following cases for both
 * input and output:
 *
 * 1. Normal lists.
 * 2. Normal sets.
 * 3. Lists of lists.
 * 4. Lists of structures.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2JsonProtocolClient, RpcV2JsonListsCommand } from "@smithy/smithy-rpcv2-json-schema"; // ES Modules import
 * // const { RpcV2JsonProtocolClient, RpcV2JsonListsCommand } = require("@smithy/smithy-rpcv2-json-schema"); // CommonJS import
 * // import type { RpcV2JsonProtocolClientConfig } from "@smithy/smithy-rpcv2-json-schema";
 * const config = {}; // type is RpcV2JsonProtocolClientConfig
 * const client = new RpcV2JsonProtocolClient(config);
 * const input = { // RpcV2JsonListInputOutput
 *   stringList: [ // StringList
 *     "STRING_VALUE",
 *   ],
 *   stringSet: [ // StringSet
 *     "STRING_VALUE",
 *   ],
 *   integerList: [ // IntegerList
 *     Number("int"),
 *   ],
 *   booleanList: [ // BooleanList
 *     true || false,
 *   ],
 *   timestampList: [ // TimestampList
 *     new Date("TIMESTAMP"),
 *   ],
 *   enumList: [ // FooEnumList
 *     "Foo" || "Baz" || "Bar" || "1" || "0",
 *   ],
 *   intEnumList: [ // IntegerEnumList
 *     1 || 2 || 3,
 *   ],
 *   nestedStringList: [ // NestedStringList
 *     [
 *       "STRING_VALUE",
 *     ],
 *   ],
 *   structureList: [ // StructureList
 *     { // StructureListMember
 *       a: "STRING_VALUE",
 *       b: "STRING_VALUE",
 *     },
 *   ],
 *   blobList: [ // BlobList
 *     new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *   ],
 * };
 * const command = new RpcV2JsonListsCommand(input);
 * const response = await client.send(command);
 * // { // RpcV2JsonListInputOutput
 * //   stringList: [ // StringList
 * //     "STRING_VALUE",
 * //   ],
 * //   stringSet: [ // StringSet
 * //     "STRING_VALUE",
 * //   ],
 * //   integerList: [ // IntegerList
 * //     Number("int"),
 * //   ],
 * //   booleanList: [ // BooleanList
 * //     true || false,
 * //   ],
 * //   timestampList: [ // TimestampList
 * //     new Date("TIMESTAMP"),
 * //   ],
 * //   enumList: [ // FooEnumList
 * //     "Foo" || "Baz" || "Bar" || "1" || "0",
 * //   ],
 * //   intEnumList: [ // IntegerEnumList
 * //     1 || 2 || 3,
 * //   ],
 * //   nestedStringList: [ // NestedStringList
 * //     [
 * //       "STRING_VALUE",
 * //     ],
 * //   ],
 * //   structureList: [ // StructureList
 * //     { // StructureListMember
 * //       a: "STRING_VALUE",
 * //       b: "STRING_VALUE",
 * //     },
 * //   ],
 * //   blobList: [ // BlobList
 * //     new Uint8Array(),
 * //   ],
 * // };
 *
 * ```
 *
 * @param RpcV2JsonListsCommandInput - {@link RpcV2JsonListsCommandInput}
 * @returns {@link RpcV2JsonListsCommandOutput}
 * @see {@link RpcV2JsonListsCommandInput} for command's `input` shape.
 * @see {@link RpcV2JsonListsCommandOutput} for command's `response` shape.
 * @see {@link RpcV2JsonProtocolClientResolvedConfig | config} for RpcV2JsonProtocolClient's `config` shape.
 *
 * @throws {@link ValidationException} (client fault)
 *  A standard error for input validation failures.
 * This should be thrown by services when a member of the input structure
 * falls outside of the modeled or documented constraints.
 *
 * @throws {@link RpcV2JsonProtocolServiceException}
 * <p>Base exception class for all service exceptions from RpcV2JsonProtocol service.</p>
 *
 *
 * @public
 */
export class RpcV2JsonListsCommand extends command<RpcV2JsonListsCommandInput, RpcV2JsonListsCommandOutput>(
  _ep0,
  _mw0,
  "RpcV2JsonLists",
  RpcV2JsonLists$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: RpcV2JsonListInputOutput;
      output: RpcV2JsonListInputOutput;
    };
    sdk: {
      input: RpcV2JsonListsCommandInput;
      output: RpcV2JsonListsCommandOutput;
    };
  };
}
