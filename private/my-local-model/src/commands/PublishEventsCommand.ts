// smithy-typescript generated code
import { Command as $Command } from "@smithy/core/client";
import { getEndpointPlugin } from "@smithy/core/endpoints";
import { getSerdePlugin } from "@smithy/core/serde";
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { commonParams } from "../endpoint/EndpointParameters";
import {
  type PublishEventsRequest,
  type PublishEventsResponse,
  PublishEventsRequestFilterSensitiveLog,
} from "../models/models_0";
import { de_PublishEventsCommand, se_PublishEventsCommand } from "../protocols/Rpcv2cbor";
import type { ServiceInputTypes, ServiceOutputTypes, XYZServiceClientResolvedConfig } from "../XYZServiceClient";

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
 * import { XYZServiceClient, PublishEventsCommand } from "xyz"; // ES Modules import
 * // const { XYZServiceClient, PublishEventsCommand } = require("xyz"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz";
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
export class PublishEventsCommand extends $Command
  .classBuilder<
    PublishEventsCommandInput,
    PublishEventsCommandOutput,
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
  .s("XYZService", "PublishEvents", {
    /**
     * @internal
     */
    eventStream: {
      input: true,
    },
  })
  .n("XYZServiceClient", "PublishEventsCommand")
  .f(PublishEventsRequestFilterSensitiveLog, void 0)
  .ser(se_PublishEventsCommand)
  .de(de_PublishEventsCommand)
  .build() {
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
