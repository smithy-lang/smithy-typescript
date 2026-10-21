// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { BigIntegerStructure } from "../models/models_0";
import { BigIntegerOperation$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link BigIntegerOperationCommand}.
 */
export interface BigIntegerOperationCommandInput extends BigIntegerStructure {}
/**
 * @public
 *
 * The output of {@link BigIntegerOperationCommand}.
 */
export interface BigIntegerOperationCommandOutput extends BigIntegerStructure, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2JsonProtocolClient, BigIntegerOperationCommand } from "@smithy/smithy-rpcv2-json-schema"; // ES Modules import
 * // const { RpcV2JsonProtocolClient, BigIntegerOperationCommand } = require("@smithy/smithy-rpcv2-json-schema"); // CommonJS import
 * // import type { RpcV2JsonProtocolClientConfig } from "@smithy/smithy-rpcv2-json-schema";
 * const config = {}; // type is RpcV2JsonProtocolClientConfig
 * const client = new RpcV2JsonProtocolClient(config);
 * const input = { // BigIntegerStructure
 *   value: Number("bigint"),
 * };
 * const command = new BigIntegerOperationCommand(input);
 * const response = await client.send(command);
 * // { // BigIntegerStructure
 * //   value: Number("bigint"),
 * // };
 *
 * ```
 *
 * @param BigIntegerOperationCommandInput - {@link BigIntegerOperationCommandInput}
 * @returns {@link BigIntegerOperationCommandOutput}
 * @see {@link BigIntegerOperationCommandInput} for command's `input` shape.
 * @see {@link BigIntegerOperationCommandOutput} for command's `response` shape.
 * @see {@link RpcV2JsonProtocolClientResolvedConfig | config} for RpcV2JsonProtocolClient's `config` shape.
 *
 * @throws {@link RpcV2JsonProtocolServiceException}
 * <p>Base exception class for all service exceptions from RpcV2JsonProtocol service.</p>
 *
 *
 */
export class BigIntegerOperationCommand extends command<BigIntegerOperationCommandInput, BigIntegerOperationCommandOutput>(
  _ep0,
  _mw0,
  "BigIntegerOperation",
  BigIntegerOperation$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: BigIntegerStructure;
      output: BigIntegerStructure;
    };
    sdk: {
      input: BigIntegerOperationCommandInput;
      output: BigIntegerOperationCommandOutput;
    };
  };
}
