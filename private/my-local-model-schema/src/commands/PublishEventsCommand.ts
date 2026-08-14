// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep3, _mw0, command } from "../commandBuilder";
import type { PublishEventsRequest, PublishEventsResponse } from "../models/models_0";
import { PublishEvents$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link PublishEventsCommand}.
 */
export interface PublishEventsCommandInput extends PublishEventsRequest {}
/**
 * @public
 *
 * The output of {@link PublishEventsCommand}.
 */
export interface PublishEventsCommandOutput extends PublishEventsResponse, __MetadataBearer {}

/**
 * Input-only event stream: client sends events, server responds with a summary.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { XYZServiceClient, PublishEventsCommand } from "xyz-schema"; // ES Modules import
 * // const { XYZServiceClient, PublishEventsCommand } = require("xyz-schema"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz-schema";
 * const config = {}; // type is XYZServiceClientConfig
 * const client = new XYZServiceClient(config);
 * const input = { // PublishEventsRequest
 *   channel: "STRING_VALUE",
 *   events: { // PublishEventStream Union: only one key present
 *     log: { // LogEvent
 *       level: "STRING_VALUE",
 *       message: "STRING_VALUE",
 *     },
 *     metric: { // MetricEvent
 *       name: "STRING_VALUE",
 *       value: Number("double"),
 *     },
 *   },
 * };
 * const command = new PublishEventsCommand(input);
 * const response = await client.send(command);
 * // { // PublishEventsResponse
 * //   eventCount: Number("int"),
 * //   message: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param PublishEventsCommandInput - {@link PublishEventsCommandInput}
 * @returns {@link PublishEventsCommandOutput}
 * @see {@link PublishEventsCommandInput} for command's `input` shape.
 * @see {@link PublishEventsCommandOutput} for command's `response` shape.
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
export class PublishEventsCommand extends command<PublishEventsCommandInput, PublishEventsCommandOutput>(
  _ep3,
  _mw0,
  "PublishEvents",
  PublishEvents$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: PublishEventsRequest;
      output: PublishEventsResponse;
    };
    sdk: {
      input: PublishEventsCommandInput;
      output: PublishEventsCommandOutput;
    };
  };
}
