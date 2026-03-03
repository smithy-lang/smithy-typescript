// smithy-typescript generated code
import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { commonParams } from "../endpoint/EndpointParameters";
import type { RpcV2CborListInputOutput } from "../models/models_0";
import { de_RpcV2CborListsCommand, se_RpcV2CborListsCommand } from "../protocols/Rpcv2cbor";
import type { RpcV2ProtocolClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../RpcV2ProtocolClient";

/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link RpcV2CborListsCommand}.
 */
export interface RpcV2CborListsCommandInput extends RpcV2CborListInputOutput {}
/**
 * @public
 *
 * The output of {@link RpcV2CborListsCommand}.
 */
export interface RpcV2CborListsCommandOutput extends RpcV2CborListInputOutput, __MetadataBearer {}

/**
 * This test case serializes JSON lists for the following cases for both
 * input and output:
 *
 * 1. Normal lists.
 * 2. Normal sets.
 * 3. Lists of lists.
 * 4. Lists of structures.
 * @public
 */
export class RpcV2CborListsCommand extends $Command
  .classBuilder<
    RpcV2CborListsCommandInput,
    RpcV2CborListsCommandOutput,
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
  .s("RpcV2Protocol", "RpcV2CborLists", {})
  .n("RpcV2ProtocolClient", "RpcV2CborListsCommand")
  .f(void 0, void 0)
  .ser(se_RpcV2CborListsCommand)
  .de(de_RpcV2CborListsCommand)
  .build() {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: RpcV2CborListInputOutput;
      output: RpcV2CborListInputOutput;
    };
    sdk: {
      input: RpcV2CborListsCommandInput;
      output: RpcV2CborListsCommandOutput;
    };
  };
}
