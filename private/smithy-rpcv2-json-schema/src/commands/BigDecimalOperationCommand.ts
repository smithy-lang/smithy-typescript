// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { BigDecimalStructure } from "../models/models_0";
import { BigDecimalOperation$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link BigDecimalOperationCommand}.
 */
export interface BigDecimalOperationCommandInput extends BigDecimalStructure {}
/**
 * @public
 *
 * The output of {@link BigDecimalOperationCommand}.
 */
export interface BigDecimalOperationCommandOutput extends BigDecimalStructure, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2JsonProtocolClient, BigDecimalOperationCommand } from "@smithy/smithy-rpcv2-json-schema"; // ES Modules import
 * // const { RpcV2JsonProtocolClient, BigDecimalOperationCommand } = require("@smithy/smithy-rpcv2-json-schema"); // CommonJS import
 * // import type { RpcV2JsonProtocolClientConfig } from "@smithy/smithy-rpcv2-json-schema";
 * const config = {}; // type is RpcV2JsonProtocolClientConfig
 * const client = new RpcV2JsonProtocolClient(config);
 * const input = { // BigDecimalStructure
 *   value: Number("bigdecimal"),
 * };
 * const command = new BigDecimalOperationCommand(input);
 * const response = await client.send(command);
 * // { // BigDecimalStructure
 * //   value: Number("bigdecimal"),
 * // };
 *
 * ```
 *
 * @param BigDecimalOperationCommandInput - {@link BigDecimalOperationCommandInput}
 * @returns {@link BigDecimalOperationCommandOutput}
 * @see {@link BigDecimalOperationCommandInput} for command's `input` shape.
 * @see {@link BigDecimalOperationCommandOutput} for command's `response` shape.
 * @see {@link RpcV2JsonProtocolClientResolvedConfig | config} for RpcV2JsonProtocolClient's `config` shape.
 *
 * @throws {@link RpcV2JsonProtocolServiceException}
 * <p>Base exception class for all service exceptions from RpcV2JsonProtocol service.</p>
 *
 *
 */
export class BigDecimalOperationCommand extends command<BigDecimalOperationCommandInput, BigDecimalOperationCommandOutput>(
  _ep0,
  _mw0,
  "BigDecimalOperation",
  BigDecimalOperation$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: BigDecimalStructure;
      output: BigDecimalStructure;
    };
    sdk: {
      input: BigDecimalOperationCommandInput;
      output: BigDecimalOperationCommandOutput;
    };
  };
}
