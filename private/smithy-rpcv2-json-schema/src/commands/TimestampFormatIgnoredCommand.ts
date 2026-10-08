// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { TimestampFormatIgnoredIO } from "../models/models_0";
import { TimestampFormatIgnored$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link TimestampFormatIgnoredCommand}.
 */
export interface TimestampFormatIgnoredCommandInput extends TimestampFormatIgnoredIO {}
/**
 * @public
 *
 * The output of {@link TimestampFormatIgnoredCommand}.
 */
export interface TimestampFormatIgnoredCommandOutput extends TimestampFormatIgnoredIO, __MetadataBearer {}

/**
 * This operation tests that the rpcv2Json protocol always uses epoch-seconds
 * for timestamp serialization, regardless of the `timestampFormat` trait.
 * Members targeting `DateTime` (date-time), `HttpDate` (http-date), and
 * `EpochSeconds` (epoch-seconds) must all serialize as JSON numbers.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2JsonProtocolClient, TimestampFormatIgnoredCommand } from "@smithy/smithy-rpcv2-json-schema"; // ES Modules import
 * // const { RpcV2JsonProtocolClient, TimestampFormatIgnoredCommand } = require("@smithy/smithy-rpcv2-json-schema"); // CommonJS import
 * // import type { RpcV2JsonProtocolClientConfig } from "@smithy/smithy-rpcv2-json-schema";
 * const config = {}; // type is RpcV2JsonProtocolClientConfig
 * const client = new RpcV2JsonProtocolClient(config);
 * const input = { // TimestampFormatIgnoredIO
 *   dateTime: new Date("TIMESTAMP"),
 *   httpDate: new Date("TIMESTAMP"),
 *   epochSeconds: new Date("TIMESTAMP"),
 *   normal: new Date("TIMESTAMP"),
 * };
 * const command = new TimestampFormatIgnoredCommand(input);
 * const response = await client.send(command);
 * // { // TimestampFormatIgnoredIO
 * //   dateTime: new Date("TIMESTAMP"),
 * //   httpDate: new Date("TIMESTAMP"),
 * //   epochSeconds: new Date("TIMESTAMP"),
 * //   normal: new Date("TIMESTAMP"),
 * // };
 *
 * ```
 *
 * @param TimestampFormatIgnoredCommandInput - {@link TimestampFormatIgnoredCommandInput}
 * @returns {@link TimestampFormatIgnoredCommandOutput}
 * @see {@link TimestampFormatIgnoredCommandInput} for command's `input` shape.
 * @see {@link TimestampFormatIgnoredCommandOutput} for command's `response` shape.
 * @see {@link RpcV2JsonProtocolClientResolvedConfig | config} for RpcV2JsonProtocolClient's `config` shape.
 *
 * @throws {@link RpcV2JsonProtocolServiceException}
 * <p>Base exception class for all service exceptions from RpcV2JsonProtocol service.</p>
 *
 *
 * @public
 */
export class TimestampFormatIgnoredCommand extends command<TimestampFormatIgnoredCommandInput, TimestampFormatIgnoredCommandOutput>(
  _ep0,
  _mw0,
  "TimestampFormatIgnored",
  TimestampFormatIgnored$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: TimestampFormatIgnoredIO;
      output: TimestampFormatIgnoredIO;
    };
    sdk: {
      input: TimestampFormatIgnoredCommandInput;
      output: TimestampFormatIgnoredCommandOutput;
    };
  };
}
