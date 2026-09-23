// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep3, _mw0, command } from "../commandBuilder";
import type { UnionMemberCollisionInput, UnionMemberCollisionOutput } from "../models/models_0";
import { UnionMemberCollisionOperation$ } from "../schemas/schemas_0";

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
 * import { XYZServiceClient, UnionMemberCollisionOperationCommand } from "xyz-schema"; // ES Modules import
 * // const { XYZServiceClient, UnionMemberCollisionOperationCommand } = require("xyz-schema"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz-schema";
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
export class UnionMemberCollisionOperationCommand extends command<UnionMemberCollisionOperationCommandInput, UnionMemberCollisionOperationCommandOutput>(
  _ep3,
  _mw0,
  "UnionMemberCollisionOperation",
  UnionMemberCollisionOperation$
) {
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
