// smithy-typescript generated code
import { RpcV2ProtocolClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../RpcV2ProtocolClient";
import { NoInputOutput } from "../schemas/smithy.protocoltests.rpcv2Cbor";
import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";

/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
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
 * import { RpcV2ProtocolClient, NoInputOutputCommand } from "@smithy/smithy-rpcv2-cbor"; // ES Modules import
 * // const { RpcV2ProtocolClient, NoInputOutputCommand } = require("@smithy/smithy-rpcv2-cbor"); // CommonJS import
 * const client = new RpcV2ProtocolClient(config);
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
 * @see {@link RpcV2ProtocolClientResolvedConfig | config} for RpcV2ProtocolClient's `config` shape.
 *
 * @throws {@link RpcV2ProtocolServiceException}
 * <p>Base exception class for all service exceptions from RpcV2Protocol service.</p>
 *
 *
 */
export class NoInputOutputCommand extends $Command
  .classBuilder<
    NoInputOutputCommandInput,
    NoInputOutputCommandOutput,
    RpcV2ProtocolClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >()
  .m(function (this: any, Command: any, cs: any, config: RpcV2ProtocolClientResolvedConfig, o: any) {
    return [];
  })
  .s("RpcV2Protocol", "NoInputOutput", {})
  .n("RpcV2ProtocolClient", "NoInputOutputCommand")
  .f(void 0, void 0)
  .sc(NoInputOutput)
  .build() {
  /** @internal type navigation helper, not in runtime. */
  declare protected static __types: {
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
