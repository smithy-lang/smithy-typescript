// smithy-typescript generated code
import { ServiceInputTypes, ServiceOutputTypes, XYZServiceClientResolvedConfig } from "../XYZServiceClient";
import { commonParams } from "../endpoint/EndpointParameters";
import { GetNumbersRequest, GetNumbersResponse } from "../models/models_0";
import { de_GetNumbersCommand, se_GetNumbersCommand } from "../protocols/Rpcv2cbor";
import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
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
 * The input for {@link GetNumbersCommand}.
 */
export interface GetNumbersCommandInput extends GetNumbersRequest {}
/**
 * @public
 *
 * The output of {@link GetNumbersCommand}.
 */
export interface GetNumbersCommandOutput extends GetNumbersResponse, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { XYZServiceClient, GetNumbersCommand } from "xyz"; // ES Modules import
 * // const { XYZServiceClient, GetNumbersCommand } = require("xyz"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz";
 * const config = {}; // type is XYZServiceClientConfig
 * const client = new XYZServiceClient(config);
 * const input = { // GetNumbersRequest
 *   bigDecimal: Number("bigdecimal"),
 *   bigInteger: Number("bigint"),
 *   fieldWithoutMessage: "STRING_VALUE",
 *   fieldWithMessage: "STRING_VALUE",
 * };
 * const command = new GetNumbersCommand(input);
 * const response = await client.send(command);
 * // { // GetNumbersResponse
 * //   bigDecimal: Number("bigdecimal"),
 * //   bigInteger: Number("bigint"),
 * // };
 *
 * ```
 *
 * @param GetNumbersCommandInput - {@link GetNumbersCommandInput}
 * @returns {@link GetNumbersCommandOutput}
 * @see {@link GetNumbersCommandInput} for command's `input` shape.
 * @see {@link GetNumbersCommandOutput} for command's `response` shape.
 * @see {@link XYZServiceClientResolvedConfig | config} for XYZServiceClient's `config` shape.
 *
 * @throws {@link CodedThrottlingError} (client fault)
 *
 * @throws {@link MysteryThrottlingError} (client fault)
 *
 * @throws {@link RetryableError} (client fault)
 *
 * @throws {@link HaltError} (client fault)
 *
 * @throws {@link XYZServiceServiceException} (client fault)
 *
 * @throws {@link XYZServiceSyntheticServiceException}
 * <p>Base exception class for all service exceptions from XYZService service.</p>
 *
 *
 */
export class GetNumbersCommand extends $Command
  .classBuilder<
    GetNumbersCommandInput,
    GetNumbersCommandOutput,
    XYZServiceClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >()
  .ep(commonParams)
  .m(function (this: any, Command: any, cs: any, config: XYZServiceClientResolvedConfig, o: any) {
    return [
      getSerdePlugin(config, this.serialize, this.deserialize),
      getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
  })
  .s("XYZService", "GetNumbers", {})
  .n("XYZServiceClient", "GetNumbersCommand")
  .f(void 0, void 0)
  .ser(se_GetNumbersCommand)
  .de(de_GetNumbersCommand)
  .build() {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: GetNumbersRequest;
      output: GetNumbersResponse;
    };
    sdk: {
      input: GetNumbersCommandInput;
      output: GetNumbersCommandOutput;
    };
  };
}
