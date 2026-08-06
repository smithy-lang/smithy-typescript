// smithy-typescript generated code
import { Command as $Command } from "@smithy/core/client";
import { getEndpointPlugin } from "@smithy/core/endpoints";
import { getSerdePlugin } from "@smithy/core/serde";
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { commonParams } from "../endpoint/EndpointParameters";
import type { ValidatedInput, ValidatedOutput } from "../models/models_0";
import { de_ValidatedOperationCommand, se_ValidatedOperationCommand } from "../protocols/Rpcv2cbor";
import type { ServiceInputTypes, ServiceOutputTypes, XYZServiceClientResolvedConfig } from "../XYZServiceClient";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link ValidatedOperationCommand}.
 */
export interface ValidatedOperationCommandInput extends ValidatedInput {}
/**
 * @public
 *
 * The output of {@link ValidatedOperationCommand}.
 */
export interface ValidatedOperationCommandOutput extends ValidatedOutput, __MetadataBearer {}

/**
 * Operation that demonstrates various constraint traits for validation testing.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { XYZServiceClient, ValidatedOperationCommand } from "xyz"; // ES Modules import
 * // const { XYZServiceClient, ValidatedOperationCommand } = require("xyz"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz";
 * const config = {}; // type is XYZServiceClientConfig
 * const client = new XYZServiceClient(config);
 * const input = { // ValidatedInput
 *   username: "STRING_VALUE",
 *   age: Number("int"),
 *   email: "STRING_VALUE",
 *   tags: [ // TagList
 *     "STRING_VALUE",
 *   ],
 *   uniqueTags: [ // UniqueTagList
 *     "STRING_VALUE",
 *   ],
 *   address: { // ConstrainedAddress
 *     zipCode: "STRING_VALUE",
 *     state: "STRING_VALUE",
 *   },
 * };
 * const command = new ValidatedOperationCommand(input);
 * const response = await client.send(command);
 * // { // ValidatedOutput
 * //   message: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param ValidatedOperationCommandInput - {@link ValidatedOperationCommandInput}
 * @returns {@link ValidatedOperationCommandOutput}
 * @see {@link ValidatedOperationCommandInput} for command's `input` shape.
 * @see {@link ValidatedOperationCommandOutput} for command's `response` shape.
 * @see {@link XYZServiceClientResolvedConfig | config} for XYZServiceClient's `config` shape.
 *
 * @throws {@link MainServiceLinkedError} (client fault)
 *
 * @throws {@link XYZServiceSyntheticServiceException}
 * <p>Base exception class for all service exceptions from XYZService service.</p>
 *
 *
 * @public
 */
export class ValidatedOperationCommand extends $Command
  .classBuilder<
    ValidatedOperationCommandInput,
    ValidatedOperationCommandOutput,
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
  .s("XYZService", "ValidatedOperation", {})
  .n("XYZServiceClient", "ValidatedOperationCommand")
  .f(void 0, void 0)
  .ser(se_ValidatedOperationCommand)
  .de(de_ValidatedOperationCommand)
  .build() {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: ValidatedInput;
      output: ValidatedOutput;
    };
    sdk: {
      input: ValidatedOperationCommandInput;
      output: ValidatedOperationCommandOutput;
    };
  };
}
