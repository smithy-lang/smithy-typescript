// smithy-typescript generated code
import { RpcV2ProtocolClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../RpcV2ProtocolClient";
import { Float16Output } from "../models/models_0";
import { Float16 } from "../schemas/smithy.protocoltests.rpcv2Cbor";
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
 * The input for {@link Float16Command}.
 */
export interface Float16CommandInput {}
/**
 * @public
 *
 * The output of {@link Float16Command}.
 */
export interface Float16CommandOutput extends Float16Output, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2ProtocolClient, Float16Command } from "@smithy/smithy-rpcv2-cbor"; // ES Modules import
 * // const { RpcV2ProtocolClient, Float16Command } = require("@smithy/smithy-rpcv2-cbor"); // CommonJS import
 * const client = new RpcV2ProtocolClient(config);
 * const input = {};
 * const command = new Float16Command(input);
 * const response = await client.send(command);
 * // { // Float16Output
 * //   value: Number("double"),
 * // };
 *
 * ```
 *
 * @param Float16CommandInput - {@link Float16CommandInput}
 * @returns {@link Float16CommandOutput}
 * @see {@link Float16CommandInput} for command's `input` shape.
 * @see {@link Float16CommandOutput} for command's `response` shape.
 * @see {@link RpcV2ProtocolClientResolvedConfig | config} for RpcV2ProtocolClient's `config` shape.
 *
 * @throws {@link RpcV2ProtocolServiceException}
 * <p>Base exception class for all service exceptions from RpcV2Protocol service.</p>
 *
 *
 */
export class Float16Command extends $Command
  .classBuilder<
    Float16CommandInput,
    Float16CommandOutput,
    RpcV2ProtocolClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >()
  .m(function (this: any, Command: any, cs: any, config: RpcV2ProtocolClientResolvedConfig, o: any) {
    return [];
  })
  .s("RpcV2Protocol", "Float16", {})
  .n("RpcV2ProtocolClient", "Float16Command")
  .f(void 0, void 0)
  .sc(Float16)
  .build() {
  /** @internal type navigation helper, not in runtime. */
  declare protected static __types: {
    api: {
      input: {};
      output: Float16Output;
    };
    sdk: {
      input: Float16CommandInput;
      output: Float16CommandOutput;
    };
  };
}
