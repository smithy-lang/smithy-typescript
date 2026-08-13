// smithy-typescript generated code
import { Command as $Command } from "@smithy/core/client";
import { getEndpointPlugin } from "@smithy/core/endpoints";
import { getSerdePlugin } from "@smithy/core/serde";
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { commonParams } from "../endpoint/EndpointParameters";
import {
  type SubscribeToEventsRequest,
  type SubscribeToEventsResponse,
  SubscribeToEventsResponseFilterSensitiveLog,
} from "../models/models_0";
import { de_SubscribeToEventsCommand, se_SubscribeToEventsCommand } from "../protocols/Rpcv2cbor";
import type { ServiceInputTypes, ServiceOutputTypes, XYZServiceClientResolvedConfig } from "../XYZServiceClient";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link SubscribeToEventsCommand}.
 */
export interface SubscribeToEventsCommandInput extends SubscribeToEventsRequest {}
/**
 * @public
 *
 * The output of {@link SubscribeToEventsCommand}.
 */
export interface SubscribeToEventsCommandOutput extends SubscribeToEventsResponse, __MetadataBearer {}

/**
 * Output-only event stream: client sends a subscription request, server streams events.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { XYZServiceClient, SubscribeToEventsCommand } from "xyz"; // ES Modules import
 * // const { XYZServiceClient, SubscribeToEventsCommand } = require("xyz"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz";
 * const config = {}; // type is XYZServiceClientConfig
 * const client = new XYZServiceClient(config);
 * const input = { // SubscribeToEventsRequest
 *   channel: "STRING_VALUE",
 *   maxEvents: Number("int"),
 * };
 * const command = new SubscribeToEventsCommand(input);
 * const response = await client.send(command);
 * // { // SubscribeToEventsResponse
 * //   subscriptionId: "STRING_VALUE",
 * //   events: { // SubscribeEventStream Union: only one key present
 * //     notification: { // NotificationEvent
 * //       topic: "STRING_VALUE",
 * //       payload: "STRING_VALUE",
 * //     },
 * //     heartbeat: { // HeartbeatEvent
 * //       timestamp: new Date("TIMESTAMP"),
 * //     },
 * //   },
 * // };
 *
 * ```
 *
 * @param SubscribeToEventsCommandInput - {@link SubscribeToEventsCommandInput}
 * @returns {@link SubscribeToEventsCommandOutput}
 * @see {@link SubscribeToEventsCommandInput} for command's `input` shape.
 * @see {@link SubscribeToEventsCommandOutput} for command's `response` shape.
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
export class SubscribeToEventsCommand extends $Command
  .classBuilder<
    SubscribeToEventsCommandInput,
    SubscribeToEventsCommandOutput,
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
  .s("XYZService", "SubscribeToEvents", {
    /**
     * @internal
     */
    eventStream: {
      output: true,
    },
  })
  .n("XYZServiceClient", "SubscribeToEventsCommand")
  .f(void 0, SubscribeToEventsResponseFilterSensitiveLog)
  .ser(se_SubscribeToEventsCommand)
  .de(de_SubscribeToEventsCommand)
  .build() {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: SubscribeToEventsRequest;
      output: SubscribeToEventsResponse;
    };
    sdk: {
      input: SubscribeToEventsCommandInput;
      output: SubscribeToEventsCommandOutput;
    };
  };
}
