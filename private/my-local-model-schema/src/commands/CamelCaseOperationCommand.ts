// smithy-typescript generated code
import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { commonParams } from "../endpoint/EndpointParameters";
import type { CamelCaseOperationInput, CamelCaseOperationOutput } from "../models/models_0";
import { camelCaseOperation$ } from "../schemas/schemas_0";
import type { ServiceInputTypes, ServiceOutputTypes, XYZServiceClientResolvedConfig } from "../XYZServiceClient";

/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link CamelCaseOperationCommand}.
 */
export interface CamelCaseOperationCommandInput extends CamelCaseOperationInput {}
/**
 * @public
 *
 * The output of {@link CamelCaseOperationCommand}.
 */
export interface CamelCaseOperationCommandOutput extends CamelCaseOperationOutput, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { XYZServiceClient, CamelCaseOperationCommand } from "xyz-schema"; // ES Modules import
 * // const { XYZServiceClient, CamelCaseOperationCommand } = require("xyz-schema"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz-schema";
 * const config = {}; // type is XYZServiceClientConfig
 * const client = new XYZServiceClient(config);
 * const input = { // camelCaseOperationInput
 *   token: "STRING_VALUE",
 * };
 * const command = new CamelCaseOperationCommand(input);
 * const response = await client.send(command);
 * // { // camelCaseOperationOutput
 * //   token: "STRING_VALUE",
 * //   results: [ // Blobs
 * //     new Uint8Array(),
 * //   ],
 * // };
 *
 * ```
 *
 * @param CamelCaseOperationCommandInput - {@link CamelCaseOperationCommandInput}
 * @returns {@link CamelCaseOperationCommandOutput}
 * @see {@link CamelCaseOperationCommandInput} for command's `input` shape.
 * @see {@link CamelCaseOperationCommandOutput} for command's `response` shape.
 * @see {@link XYZServiceClientResolvedConfig | config} for XYZServiceClient's `config` shape.
 *
 * @throws {@link MainServiceLinkedError} (client fault)
 *
 * @throws {@link XYZServiceSyntheticServiceException}
 * <p>Base exception class for all service exceptions from XYZService service.</p>
 *
 *
 */
export class CamelCaseOperationCommand extends $Command
  .classBuilder<
    CamelCaseOperationCommandInput,
    CamelCaseOperationCommandOutput,
    XYZServiceClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >()
  .ep(commonParams)
  .m(function (this: any, Command: any, cs: any, config: XYZServiceClientResolvedConfig, o: any) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
  })
  .s("XYZService", "camelCaseOperation", {})
  .n("XYZServiceClient", "CamelCaseOperationCommand")
  .sc(camelCaseOperation$)
  .build() {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: CamelCaseOperationInput;
      output: CamelCaseOperationOutput;
    };
    sdk: {
      input: CamelCaseOperationCommandInput;
      output: CamelCaseOperationCommandOutput;
    };
  };
}
