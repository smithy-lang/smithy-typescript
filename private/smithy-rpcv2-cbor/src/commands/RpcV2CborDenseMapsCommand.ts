// smithy-typescript generated code
import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { commonParams } from "../endpoint/EndpointParameters";
import type { RpcV2CborDenseMapsInputOutput } from "../models/models_0";
import { de_RpcV2CborDenseMapsCommand, se_RpcV2CborDenseMapsCommand } from "../protocols/Rpcv2cbor";
import type { RpcV2ProtocolClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../RpcV2ProtocolClient";

/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link RpcV2CborDenseMapsCommand}.
 */
export interface RpcV2CborDenseMapsCommandInput extends RpcV2CborDenseMapsInputOutput {}
/**
 * @public
 *
 * The output of {@link RpcV2CborDenseMapsCommand}.
 */
export interface RpcV2CborDenseMapsCommandOutput extends RpcV2CborDenseMapsInputOutput, __MetadataBearer {}

/**
 * The example tests basic map serialization.
 * @public
 */
export class RpcV2CborDenseMapsCommand extends $Command
  .classBuilder<
    RpcV2CborDenseMapsCommandInput,
    RpcV2CborDenseMapsCommandOutput,
    RpcV2ProtocolClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >()
  .ep(commonParams)
  .m(function (this: any, Command: any, cs: any, config: RpcV2ProtocolClientResolvedConfig, o: any) {
    return [
      getSerdePlugin(config, this.serialize, this.deserialize),
      getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
  })
  .s("RpcV2Protocol", "RpcV2CborDenseMaps", {})
  .n("RpcV2ProtocolClient", "RpcV2CborDenseMapsCommand")
  .f(void 0, void 0)
  .ser(se_RpcV2CborDenseMapsCommand)
  .de(de_RpcV2CborDenseMapsCommand)
  .build() {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: RpcV2CborDenseMapsInputOutput;
      output: RpcV2CborDenseMapsInputOutput;
    };
    sdk: {
      input: RpcV2CborDenseMapsCommandInput;
      output: RpcV2CborDenseMapsCommandOutput;
    };
  };
}
