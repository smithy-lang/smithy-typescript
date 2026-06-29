// smithy-typescript generated code
import { Command as $Command } from "@smithy/core/client";
import { getEndpointPlugin } from "@smithy/core/endpoints";
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { commonParams } from "../endpoint/EndpointParameters";
import type { HostPrefixInput } from "../models/models_0";
import { HostPrefixOperation$ } from "../schemas/schemas_0";
import type { ServiceInputTypes, ServiceOutputTypes, XYZServiceClientResolvedConfig } from "../XYZServiceClient";

/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link HostPrefixOperationCommand}.
 */
export interface HostPrefixOperationCommandInput extends HostPrefixInput {}
/**
 * @public
 *
 * The output of {@link HostPrefixOperationCommand}.
 */
export interface HostPrefixOperationCommandOutput extends __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { XYZServiceClient, HostPrefixOperationCommand } from "xyz-schema"; // ES Modules import
 * // const { XYZServiceClient, HostPrefixOperationCommand } = require("xyz-schema"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz-schema";
 * const config = {}; // type is XYZServiceClientConfig
 * const client = new XYZServiceClient(config);
 * const input = { // HostPrefixInput
 *   AccountId: "STRING_VALUE", // required
 * };
 * const command = new HostPrefixOperationCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param HostPrefixOperationCommandInput - {@link HostPrefixOperationCommandInput}
 * @returns {@link HostPrefixOperationCommandOutput}
 * @see {@link HostPrefixOperationCommandInput} for command's `input` shape.
 * @see {@link HostPrefixOperationCommandOutput} for command's `response` shape.
 * @see {@link XYZServiceClientResolvedConfig | config} for XYZServiceClient's `config` shape.
 *
 * @throws {@link MainServiceLinkedError} (client fault)
 *
 * @throws {@link XYZServiceSyntheticServiceException}
 * <p>Base exception class for all service exceptions from XYZService service.</p>
 *
 *
 */
export class HostPrefixOperationCommand extends $Command
  .classBuilder<
    HostPrefixOperationCommandInput,
    HostPrefixOperationCommandOutput,
    XYZServiceClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >()
  .ep(commonParams)
  .m(function (this: any, Command: any, cs: any, config: XYZServiceClientResolvedConfig, o: any) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
  })
  .s("XYZService", "HostPrefixOperation", {})
  .n("XYZServiceClient", "HostPrefixOperationCommand")
  .sc(HostPrefixOperation$)
  .build() {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: HostPrefixInput;
      output: {};
    };
    sdk: {
      input: HostPrefixOperationCommandInput;
      output: HostPrefixOperationCommandOutput;
    };
  };
}
