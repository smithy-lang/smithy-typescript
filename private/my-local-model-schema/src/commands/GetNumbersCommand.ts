// smithy-typescript generated code
import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { commonParams } from "../endpoint/EndpointParameters";
import type { GetNumbersRequest, GetNumbersResponse } from "../models/models_0";
import { GetNumbers$ } from "../schemas/schemas_0";
import type { ServiceInputTypes, ServiceOutputTypes, XYZServiceClientResolvedConfig } from "../XYZServiceClient";

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
 * import { XYZServiceClient, GetNumbersCommand } from "xyz-schema"; // ES Modules import
 * // const { XYZServiceClient, GetNumbersCommand } = require("xyz-schema"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz-schema";
 * const config = {}; // type is XYZServiceClientConfig
 * const client = new XYZServiceClient(config);
 * const input = { // GetNumbersRequest
 *   bigDecimal: Number("bigdecimal"),
 *   bigInteger: Number("bigint"),
 *   fieldWithoutMessage: "STRING_VALUE",
 *   fieldWithMessage: "STRING_VALUE",
 *   startToken: "STRING_VALUE",
 *   maxResults: Number("int"),
 * };
 * const command = new GetNumbersCommand(input);
 * const response = await client.send(command);
 * // { // GetNumbersResponse
 * //   bigDecimal: Number("bigdecimal"),
 * //   bigInteger: Number("bigint"),
 * //   numbers: [ // IntegerList
 * //     Number("int"),
 * //   ],
 * //   nextToken: "STRING_VALUE",
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
 * @throws {@link MainServiceLinkedError} (client fault)
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
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
  })
  .s("XYZService", "GetNumbers", {})
  .n("XYZServiceClient", "GetNumbersCommand")
  .sc(GetNumbers$)
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
