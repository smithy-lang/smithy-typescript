// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { TradeEventStreamRequest, TradeEventStreamResponse } from "../models/models_0";
import { TradeEventStream$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
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
 * import { XYZServiceClient, TradeEventStreamCommand } from "xyz-schema"; // ES Modules import
 * // const { XYZServiceClient, TradeEventStreamCommand } = require("xyz-schema"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz-schema";
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
 *     delta: { // DifferentShapeName
 *       name: "STRING_VALUE",
 *       number: Number("int"),
 *     },
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
 * //     delta: { // DifferentShapeName
 * //       name: "STRING_VALUE",
 * //       number: Number("int"),
 * //     },
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
export class TradeEventStreamCommand extends command<TradeEventStreamCommandInput, TradeEventStreamCommandOutput>(
  _ep0,
  _mw0,
  "TradeEventStream",
  TradeEventStream$
) {
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
