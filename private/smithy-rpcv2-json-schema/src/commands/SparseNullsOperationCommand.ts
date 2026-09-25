// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { SparseNullsOperationInputOutput } from "../models/models_0";
import { SparseNullsOperation$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link SparseNullsOperationCommand}.
 */
export interface SparseNullsOperationCommandInput extends SparseNullsOperationInputOutput {}
/**
 * @public
 *
 * The output of {@link SparseNullsOperationCommand}.
 */
export interface SparseNullsOperationCommandOutput extends SparseNullsOperationInputOutput, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2JsonProtocolClient, SparseNullsOperationCommand } from "@smithy/smithy-rpcv2-json-schema"; // ES Modules import
 * // const { RpcV2JsonProtocolClient, SparseNullsOperationCommand } = require("@smithy/smithy-rpcv2-json-schema"); // CommonJS import
 * // import type { RpcV2JsonProtocolClientConfig } from "@smithy/smithy-rpcv2-json-schema";
 * const config = {}; // type is RpcV2JsonProtocolClientConfig
 * const client = new RpcV2JsonProtocolClient(config);
 * const input = { // SparseNullsOperationInputOutput
 *   sparseStringList: [ // SparseStringList
 *     "STRING_VALUE",
 *   ],
 *   sparseStringMap: { // SparseStringMap
 *     "<keys>": "STRING_VALUE",
 *   },
 * };
 * const command = new SparseNullsOperationCommand(input);
 * const response = await client.send(command);
 * // { // SparseNullsOperationInputOutput
 * //   sparseStringList: [ // SparseStringList
 * //     "STRING_VALUE",
 * //   ],
 * //   sparseStringMap: { // SparseStringMap
 * //     "<keys>": "STRING_VALUE",
 * //   },
 * // };
 *
 * ```
 *
 * @param SparseNullsOperationCommandInput - {@link SparseNullsOperationCommandInput}
 * @returns {@link SparseNullsOperationCommandOutput}
 * @see {@link SparseNullsOperationCommandInput} for command's `input` shape.
 * @see {@link SparseNullsOperationCommandOutput} for command's `response` shape.
 * @see {@link RpcV2JsonProtocolClientResolvedConfig | config} for RpcV2JsonProtocolClient's `config` shape.
 *
 * @throws {@link RpcV2JsonProtocolServiceException}
 * <p>Base exception class for all service exceptions from RpcV2JsonProtocol service.</p>
 *
 *
 */
export class SparseNullsOperationCommand extends command<SparseNullsOperationCommandInput, SparseNullsOperationCommandOutput>(
  _ep0,
  _mw0,
  "SparseNullsOperation",
  SparseNullsOperation$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: SparseNullsOperationInputOutput;
      output: SparseNullsOperationInputOutput;
    };
    sdk: {
      input: SparseNullsOperationCommandInput;
      output: SparseNullsOperationCommandOutput;
    };
  };
}
