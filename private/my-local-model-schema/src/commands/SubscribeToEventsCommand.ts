// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep3, _mw0, command } from "../commandBuilder";
import type { SubscribeToEventsRequest, SubscribeToEventsResponse } from "../models/models_0";
import { SubscribeToEvents$ } from "../schemas/schemas_0";

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
 * import { XYZServiceClient, SubscribeToEventsCommand } from "xyz-schema"; // ES Modules import
 * // const { XYZServiceClient, SubscribeToEventsCommand } = require("xyz-schema"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz-schema";
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
export class SubscribeToEventsCommand extends command<SubscribeToEventsCommandInput, SubscribeToEventsCommandOutput>(
  _ep3,
  _mw0,
  "SubscribeToEvents",
  SubscribeToEvents$
) {
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
