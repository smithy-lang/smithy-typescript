// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { RpcV2JsonSparseMapsInputOutput } from "../models/models_0";
import { RpcV2JsonSparseMaps$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link RpcV2JsonSparseMapsCommand}.
 */
export interface RpcV2JsonSparseMapsCommandInput extends RpcV2JsonSparseMapsInputOutput {}
/**
 * @public
 *
 * The output of {@link RpcV2JsonSparseMapsCommand}.
 */
export interface RpcV2JsonSparseMapsCommandOutput extends RpcV2JsonSparseMapsInputOutput, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2JsonProtocolClient, RpcV2JsonSparseMapsCommand } from "@smithy/smithy-rpcv2-json-schema"; // ES Modules import
 * // const { RpcV2JsonProtocolClient, RpcV2JsonSparseMapsCommand } = require("@smithy/smithy-rpcv2-json-schema"); // CommonJS import
 * // import type { RpcV2JsonProtocolClientConfig } from "@smithy/smithy-rpcv2-json-schema";
 * const config = {}; // type is RpcV2JsonProtocolClientConfig
 * const client = new RpcV2JsonProtocolClient(config);
 * const input = { // RpcV2JsonSparseMapsInputOutput
 *   sparseStructMap: { // SparseStructMap
 *     "<keys>": { // GreetingStruct
 *       hi: "STRING_VALUE",
 *     },
 *   },
 *   sparseNumberMap: { // SparseNumberMap
 *     "<keys>": Number("int"),
 *   },
 *   sparseBooleanMap: { // SparseBooleanMap
 *     "<keys>": true || false,
 *   },
 *   sparseStringMap: { // SparseStringMap
 *     "<keys>": "STRING_VALUE",
 *   },
 *   sparseSetMap: { // SparseSetMap
 *     "<keys>": [ // StringSet
 *       "STRING_VALUE",
 *     ],
 *   },
 * };
 * const command = new RpcV2JsonSparseMapsCommand(input);
 * const response = await client.send(command);
 * // { // RpcV2JsonSparseMapsInputOutput
 * //   sparseStructMap: { // SparseStructMap
 * //     "<keys>": { // GreetingStruct
 * //       hi: "STRING_VALUE",
 * //     },
 * //   },
 * //   sparseNumberMap: { // SparseNumberMap
 * //     "<keys>": Number("int"),
 * //   },
 * //   sparseBooleanMap: { // SparseBooleanMap
 * //     "<keys>": true || false,
 * //   },
 * //   sparseStringMap: { // SparseStringMap
 * //     "<keys>": "STRING_VALUE",
 * //   },
 * //   sparseSetMap: { // SparseSetMap
 * //     "<keys>": [ // StringSet
 * //       "STRING_VALUE",
 * //     ],
 * //   },
 * // };
 *
 * ```
 *
 * @param RpcV2JsonSparseMapsCommandInput - {@link RpcV2JsonSparseMapsCommandInput}
 * @returns {@link RpcV2JsonSparseMapsCommandOutput}
 * @see {@link RpcV2JsonSparseMapsCommandInput} for command's `input` shape.
 * @see {@link RpcV2JsonSparseMapsCommandOutput} for command's `response` shape.
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
 */
export class RpcV2JsonSparseMapsCommand extends command<RpcV2JsonSparseMapsCommandInput, RpcV2JsonSparseMapsCommandOutput>(
  _ep0,
  _mw0,
  "RpcV2JsonSparseMaps",
  RpcV2JsonSparseMaps$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: RpcV2JsonSparseMapsInputOutput;
      output: RpcV2JsonSparseMapsInputOutput;
    };
    sdk: {
      input: RpcV2JsonSparseMapsCommandInput;
      output: RpcV2JsonSparseMapsCommandOutput;
    };
  };
}
