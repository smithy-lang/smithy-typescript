// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { RpcV2JsonDenseMapsInputOutput } from "../models/models_0";
import { RpcV2JsonDenseMaps$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link RpcV2JsonDenseMapsCommand}.
 */
export interface RpcV2JsonDenseMapsCommandInput extends RpcV2JsonDenseMapsInputOutput {}
/**
 * @public
 *
 * The output of {@link RpcV2JsonDenseMapsCommand}.
 */
export interface RpcV2JsonDenseMapsCommandOutput extends RpcV2JsonDenseMapsInputOutput, __MetadataBearer {}

/**
 * The example tests basic map serialization.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2JsonProtocolClient, RpcV2JsonDenseMapsCommand } from "@smithy/smithy-rpcv2-json-schema"; // ES Modules import
 * // const { RpcV2JsonProtocolClient, RpcV2JsonDenseMapsCommand } = require("@smithy/smithy-rpcv2-json-schema"); // CommonJS import
 * // import type { RpcV2JsonProtocolClientConfig } from "@smithy/smithy-rpcv2-json-schema";
 * const config = {}; // type is RpcV2JsonProtocolClientConfig
 * const client = new RpcV2JsonProtocolClient(config);
 * const input = { // RpcV2JsonDenseMapsInputOutput
 *   denseStructMap: { // DenseStructMap
 *     "<keys>": { // GreetingStruct
 *       hi: "STRING_VALUE",
 *     },
 *   },
 *   denseNumberMap: { // DenseNumberMap
 *     "<keys>": Number("int"),
 *   },
 *   denseBooleanMap: { // DenseBooleanMap
 *     "<keys>": true || false,
 *   },
 *   denseStringMap: { // DenseStringMap
 *     "<keys>": "STRING_VALUE",
 *   },
 *   denseSetMap: { // DenseSetMap
 *     "<keys>": [ // StringSet
 *       "STRING_VALUE",
 *     ],
 *   },
 * };
 * const command = new RpcV2JsonDenseMapsCommand(input);
 * const response = await client.send(command);
 * // { // RpcV2JsonDenseMapsInputOutput
 * //   denseStructMap: { // DenseStructMap
 * //     "<keys>": { // GreetingStruct
 * //       hi: "STRING_VALUE",
 * //     },
 * //   },
 * //   denseNumberMap: { // DenseNumberMap
 * //     "<keys>": Number("int"),
 * //   },
 * //   denseBooleanMap: { // DenseBooleanMap
 * //     "<keys>": true || false,
 * //   },
 * //   denseStringMap: { // DenseStringMap
 * //     "<keys>": "STRING_VALUE",
 * //   },
 * //   denseSetMap: { // DenseSetMap
 * //     "<keys>": [ // StringSet
 * //       "STRING_VALUE",
 * //     ],
 * //   },
 * // };
 *
 * ```
 *
 * @param RpcV2JsonDenseMapsCommandInput - {@link RpcV2JsonDenseMapsCommandInput}
 * @returns {@link RpcV2JsonDenseMapsCommandOutput}
 * @see {@link RpcV2JsonDenseMapsCommandInput} for command's `input` shape.
 * @see {@link RpcV2JsonDenseMapsCommandOutput} for command's `response` shape.
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
export class RpcV2JsonDenseMapsCommand extends command<RpcV2JsonDenseMapsCommandInput, RpcV2JsonDenseMapsCommandOutput>(
  _ep0,
  _mw0,
  "RpcV2JsonDenseMaps",
  RpcV2JsonDenseMaps$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: RpcV2JsonDenseMapsInputOutput;
      output: RpcV2JsonDenseMapsInputOutput;
    };
    sdk: {
      input: RpcV2JsonDenseMapsCommandInput;
      output: RpcV2JsonDenseMapsCommandOutput;
    };
  };
}
