// smithy-typescript generated code
import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { commonParams } from "../endpoint/EndpointParameters";
import {
  type TradeEventStreamRequest,
  type TradeEventStreamResponse,
  TradeEventStreamRequestFilterSensitiveLog,
  TradeEventStreamResponseFilterSensitiveLog,
} from "../models/models_0";
import { de_TradeEventStreamCommand, se_TradeEventStreamCommand } from "../protocols/Rpcv2cbor";
import type { ServiceInputTypes, ServiceOutputTypes, XYZServiceClientResolvedConfig } from "../XYZServiceClient";

/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link TradeEventStreamCommand}.
 */
export interface TradeEventStreamCommandInput extends TradeEventStreamRequest {}
/**
 * @public
 *
 * The output of {@link TradeEventStreamCommand}.
 */
export interface TradeEventStreamCommandOutput extends TradeEventStreamResponse, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { XYZServiceClient, TradeEventStreamCommand } from "xyz"; // ES Modules import
 * // const { XYZServiceClient, TradeEventStreamCommand } = require("xyz"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz";
 * const config = {}; // type is XYZServiceClientConfig
 * const client = new XYZServiceClient(config);
 * const input = { // TradeEventStreamRequest
 *   eventStream: { // TradeEvents Union: only one key present
 *     alpha: { // Alpha
 *       id: "STRING_VALUE",
 *       timestamp: new Date("TIMESTAMP"),
 *     },
 *     beta: {},
 *     gamma: {},
 *   },
 * };
 * const command = new TradeEventStreamCommand(input);
 * const response = await client.send(command);
 * // { // TradeEventStreamResponse
 * //   eventStream: { // TradeEvents Union: only one key present
 * //     alpha: { // Alpha
 * //       id: "STRING_VALUE",
 * //       timestamp: new Date("TIMESTAMP"),
 * //     },
 * //     beta: {},
 * //     gamma: {},
 * //   },
 * // };
 *
 * ```
 *
 * @param TradeEventStreamCommandInput - {@link TradeEventStreamCommandInput}
 * @returns {@link TradeEventStreamCommandOutput}
 * @see {@link TradeEventStreamCommandInput} for command's `input` shape.
 * @see {@link TradeEventStreamCommandOutput} for command's `response` shape.
 * @see {@link XYZServiceClientResolvedConfig | config} for XYZServiceClient's `config` shape.
 *
 * @throws {@link MainServiceLinkedError} (client fault)
 *
 * @throws {@link XYZServiceSyntheticServiceException}
 * <p>Base exception class for all service exceptions from XYZService service.</p>
 *
 *
 */
export class TradeEventStreamCommand extends $Command
  .classBuilder<
    TradeEventStreamCommandInput,
    TradeEventStreamCommandOutput,
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
  .s("XYZService", "TradeEventStream", {
    /**
     * @internal
     */
    eventStream: {
      input: true,
      output: true,
    },
  })
  .n("XYZServiceClient", "TradeEventStreamCommand")
  .f(TradeEventStreamRequestFilterSensitiveLog, TradeEventStreamResponseFilterSensitiveLog)
  .ser(se_TradeEventStreamCommand)
  .de(de_TradeEventStreamCommand)
  .build() {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: TradeEventStreamRequest;
      output: TradeEventStreamResponse;
    };
    sdk: {
      input: TradeEventStreamCommandInput;
      output: TradeEventStreamCommandOutput;
    };
  };
}
