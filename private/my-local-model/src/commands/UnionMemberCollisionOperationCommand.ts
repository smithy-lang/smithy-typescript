// smithy-typescript generated code
import { Command as $Command } from "@smithy/core/client";
import { getEndpointPlugin } from "@smithy/core/endpoints";
import { getSerdePlugin } from "@smithy/core/serde";
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { commonParams } from "../endpoint/EndpointParameters";
import type { UnionMemberCollisionInput, UnionMemberCollisionOutput } from "../models/models_0";
import {
  de_UnionMemberCollisionOperationCommand,
  se_UnionMemberCollisionOperationCommand,
} from "../protocols/Rpcv2cbor";
import type { ServiceInputTypes, ServiceOutputTypes, XYZServiceClientResolvedConfig } from "../XYZServiceClient";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link UnionMemberCollisionOperationCommand}.
 */
export interface UnionMemberCollisionOperationCommandInput extends UnionMemberCollisionInput {}
/**
 * @public
 *
 * The output of {@link UnionMemberCollisionOperationCommand}.
 */
export interface UnionMemberCollisionOperationCommandOutput extends UnionMemberCollisionOutput, __MetadataBearer {}

/**
 * Regression coverage for union variant interface shadowing: a union member
 * whose target structure is named `<CapitalizedMemberName>Member` collides with
 * the generated namespace-local variant interface name. See issue #2280.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { XYZServiceClient, UnionMemberCollisionOperationCommand } from "xyz"; // ES Modules import
 * // const { XYZServiceClient, UnionMemberCollisionOperationCommand } = require("xyz"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz";
 * const config = {}; // type is XYZServiceClientConfig
 * const client = new XYZServiceClient(config);
 * const input = { // UnionMemberCollisionInput
 *   thing: { // Thing Union: only one key present
 *     widget: { // WidgetMember
 *       widgetId: "STRING_VALUE",
 *     },
 *     gadget: { // Gadget
 *       gadgetId: "STRING_VALUE",
 *     },
 *   },
 * };
 * const command = new UnionMemberCollisionOperationCommand(input);
 * const response = await client.send(command);
 * // { // UnionMemberCollisionOutput
 * //   thing: { // Thing Union: only one key present
 * //     widget: { // WidgetMember
 * //       widgetId: "STRING_VALUE",
 * //     },
 * //     gadget: { // Gadget
 * //       gadgetId: "STRING_VALUE",
 * //     },
 * //   },
 * // };
 *
 * ```
 *
 * @param UnionMemberCollisionOperationCommandInput - {@link UnionMemberCollisionOperationCommandInput}
 * @returns {@link UnionMemberCollisionOperationCommandOutput}
 * @see {@link UnionMemberCollisionOperationCommandInput} for command's `input` shape.
 * @see {@link UnionMemberCollisionOperationCommandOutput} for command's `response` shape.
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
export class UnionMemberCollisionOperationCommand extends $Command
  .classBuilder<
    UnionMemberCollisionOperationCommandInput,
    UnionMemberCollisionOperationCommandOutput,
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
  .s("XYZService", "UnionMemberCollisionOperation", {})
  .n("XYZServiceClient", "UnionMemberCollisionOperationCommand")
  .f(void 0, void 0)
  .ser(se_UnionMemberCollisionOperationCommand)
  .de(de_UnionMemberCollisionOperationCommand)
  .build() {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: UnionMemberCollisionInput;
      output: UnionMemberCollisionOutput;
    };
    sdk: {
      input: UnionMemberCollisionOperationCommandInput;
      output: UnionMemberCollisionOperationCommandOutput;
    };
  };
}
