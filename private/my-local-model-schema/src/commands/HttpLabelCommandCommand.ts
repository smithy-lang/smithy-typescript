// smithy-typescript generated code
import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { commonParams } from "../endpoint/EndpointParameters";
import type { HttpLabelCommandInput, HttpLabelCommandOutput } from "../models/models_0";
import { HttpLabelCommand$ } from "../schemas/schemas_0";
import type { ServiceInputTypes, ServiceOutputTypes, XYZServiceClientResolvedConfig } from "../XYZServiceClient";

/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link HttpLabelCommandCommand}.
 */
export interface HttpLabelCommandCommandInput extends HttpLabelCommandInput {}
/**
 * @public
 *
 * The output of {@link HttpLabelCommandCommand}.
 */
export interface HttpLabelCommandCommandOutput extends HttpLabelCommandOutput, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { XYZServiceClient, HttpLabelCommandCommand } from "xyz-schema"; // ES Modules import
 * // const { XYZServiceClient, HttpLabelCommandCommand } = require("xyz-schema"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz-schema";
 * const config = {}; // type is XYZServiceClientConfig
 * const client = new XYZServiceClient(config);
 * const input = { // HttpLabelCommandInput
 *   LabelDoesNotApplyToRpcProtocol: "STRING_VALUE", // required
 * };
 * const command = new HttpLabelCommandCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param HttpLabelCommandCommandInput - {@link HttpLabelCommandCommandInput}
 * @returns {@link HttpLabelCommandCommandOutput}
 * @see {@link HttpLabelCommandCommandInput} for command's `input` shape.
 * @see {@link HttpLabelCommandCommandOutput} for command's `response` shape.
 * @see {@link XYZServiceClientResolvedConfig | config} for XYZServiceClient's `config` shape.
 *
 * @throws {@link MainServiceLinkedError} (client fault)
 *
 * @throws {@link XYZServiceSyntheticServiceException}
 * <p>Base exception class for all service exceptions from XYZService service.</p>
 *
 *
 */
export class HttpLabelCommandCommand extends $Command
  .classBuilder<
    HttpLabelCommandCommandInput,
    HttpLabelCommandCommandOutput,
    XYZServiceClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >()
  .ep(commonParams)
  .m(function (this: any, Command: any, cs: any, config: XYZServiceClientResolvedConfig, o: any) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
  })
  .s("XYZService", "HttpLabelCommand", {})
  .n("XYZServiceClient", "HttpLabelCommandCommand")
  .sc(HttpLabelCommand$)
  .build() {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: HttpLabelCommandInput;
      output: {};
    };
    sdk: {
      input: HttpLabelCommandCommandInput;
      output: HttpLabelCommandCommandOutput;
    };
  };
}
