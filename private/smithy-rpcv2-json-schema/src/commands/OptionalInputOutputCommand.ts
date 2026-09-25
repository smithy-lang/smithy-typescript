// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { SimpleStructure } from "../models/models_0";
import { OptionalInputOutput$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link OptionalInputOutputCommand}.
 */
export interface OptionalInputOutputCommandInput extends SimpleStructure {}
/**
 * @public
 *
 * The output of {@link OptionalInputOutputCommand}.
 */
export interface OptionalInputOutputCommandOutput extends SimpleStructure, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2JsonProtocolClient, OptionalInputOutputCommand } from "@smithy/smithy-rpcv2-json-schema"; // ES Modules import
 * // const { RpcV2JsonProtocolClient, OptionalInputOutputCommand } = require("@smithy/smithy-rpcv2-json-schema"); // CommonJS import
 * // import type { RpcV2JsonProtocolClientConfig } from "@smithy/smithy-rpcv2-json-schema";
 * const config = {}; // type is RpcV2JsonProtocolClientConfig
 * const client = new RpcV2JsonProtocolClient(config);
 * const input = { // SimpleStructure
 *   value: "STRING_VALUE",
 * };
 * const command = new OptionalInputOutputCommand(input);
 * const response = await client.send(command);
 * // { // SimpleStructure
 * //   value: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param OptionalInputOutputCommandInput - {@link OptionalInputOutputCommandInput}
 * @returns {@link OptionalInputOutputCommandOutput}
 * @see {@link OptionalInputOutputCommandInput} for command's `input` shape.
 * @see {@link OptionalInputOutputCommandOutput} for command's `response` shape.
 * @see {@link RpcV2JsonProtocolClientResolvedConfig | config} for RpcV2JsonProtocolClient's `config` shape.
 *
 * @throws {@link RpcV2JsonProtocolServiceException}
 * <p>Base exception class for all service exceptions from RpcV2JsonProtocol service.</p>
 *
 *
 */
export class OptionalInputOutputCommand extends command<OptionalInputOutputCommandInput, OptionalInputOutputCommandOutput>(
  _ep0,
  _mw0,
  "OptionalInputOutput",
  OptionalInputOutput$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: SimpleStructure;
      output: SimpleStructure;
    };
    sdk: {
      input: OptionalInputOutputCommandInput;
      output: OptionalInputOutputCommandOutput;
    };
  };
}
