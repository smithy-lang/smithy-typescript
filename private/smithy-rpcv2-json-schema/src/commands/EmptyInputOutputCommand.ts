// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { EmptyStructure } from "../models/models_0";
import { EmptyInputOutput$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link EmptyInputOutputCommand}.
 */
export interface EmptyInputOutputCommandInput extends EmptyStructure {}
/**
 * @public
 *
 * The output of {@link EmptyInputOutputCommand}.
 */
export interface EmptyInputOutputCommandOutput extends EmptyStructure, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2JsonProtocolClient, EmptyInputOutputCommand } from "@smithy/smithy-rpcv2-json-schema"; // ES Modules import
 * // const { RpcV2JsonProtocolClient, EmptyInputOutputCommand } = require("@smithy/smithy-rpcv2-json-schema"); // CommonJS import
 * // import type { RpcV2JsonProtocolClientConfig } from "@smithy/smithy-rpcv2-json-schema";
 * const config = {}; // type is RpcV2JsonProtocolClientConfig
 * const client = new RpcV2JsonProtocolClient(config);
 * const input = {};
 * const command = new EmptyInputOutputCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param EmptyInputOutputCommandInput - {@link EmptyInputOutputCommandInput}
 * @returns {@link EmptyInputOutputCommandOutput}
 * @see {@link EmptyInputOutputCommandInput} for command's `input` shape.
 * @see {@link EmptyInputOutputCommandOutput} for command's `response` shape.
 * @see {@link RpcV2JsonProtocolClientResolvedConfig | config} for RpcV2JsonProtocolClient's `config` shape.
 *
 * @throws {@link RpcV2JsonProtocolServiceException}
 * <p>Base exception class for all service exceptions from RpcV2JsonProtocol service.</p>
 *
 *
 */
export class EmptyInputOutputCommand extends command<EmptyInputOutputCommandInput, EmptyInputOutputCommandOutput>(
  _ep0,
  _mw0,
  "EmptyInputOutput",
  EmptyInputOutput$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: {};
      output: {};
    };
    sdk: {
      input: EmptyInputOutputCommandInput;
      output: EmptyInputOutputCommandOutput;
    };
  };
}
