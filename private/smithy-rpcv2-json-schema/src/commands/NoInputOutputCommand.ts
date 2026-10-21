// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import { NoInputOutput$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link NoInputOutputCommand}.
 */
export interface NoInputOutputCommandInput {}
/**
 * @public
 *
 * The output of {@link NoInputOutputCommand}.
 */
export interface NoInputOutputCommandOutput extends __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2JsonProtocolClient, NoInputOutputCommand } from "@smithy/smithy-rpcv2-json-schema"; // ES Modules import
 * // const { RpcV2JsonProtocolClient, NoInputOutputCommand } = require("@smithy/smithy-rpcv2-json-schema"); // CommonJS import
 * // import type { RpcV2JsonProtocolClientConfig } from "@smithy/smithy-rpcv2-json-schema";
 * const config = {}; // type is RpcV2JsonProtocolClientConfig
 * const client = new RpcV2JsonProtocolClient(config);
 * const input = {};
 * const command = new NoInputOutputCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param NoInputOutputCommandInput - {@link NoInputOutputCommandInput}
 * @returns {@link NoInputOutputCommandOutput}
 * @see {@link NoInputOutputCommandInput} for command's `input` shape.
 * @see {@link NoInputOutputCommandOutput} for command's `response` shape.
 * @see {@link RpcV2JsonProtocolClientResolvedConfig | config} for RpcV2JsonProtocolClient's `config` shape.
 *
 * @throws {@link RpcV2JsonProtocolServiceException}
 * <p>Base exception class for all service exceptions from RpcV2JsonProtocol service.</p>
 *
 *
 */
export class NoInputOutputCommand extends command<NoInputOutputCommandInput, NoInputOutputCommandOutput>(
  _ep0,
  _mw0,
  "NoInputOutput",
  NoInputOutput$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: {};
      output: {};
    };
    sdk: {
      input: NoInputOutputCommandInput;
      output: NoInputOutputCommandOutput;
    };
  };
}
