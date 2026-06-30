// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { HostPrefixOperationInput } from "../models/models_0";
import { HostPrefixOperation$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link HostPrefixOperationCommand}.
 */
export interface HostPrefixOperationCommandInput extends HostPrefixOperationInput {}
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
 * const input = { // HostPrefixOperationInput
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
export class HostPrefixOperationCommand extends command<HostPrefixOperationCommandInput, HostPrefixOperationCommandOutput>(
  _ep0,
  _mw0,
  "HostPrefixOperation",
  HostPrefixOperation$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: HostPrefixOperationInput;
      output: {};
    };
    sdk: {
      input: HostPrefixOperationCommandInput;
      output: HostPrefixOperationCommandOutput;
    };
  };
}
