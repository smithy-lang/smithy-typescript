// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep1, _mw0, command } from "../commandBuilder";
import type { GetNumbersRequest, GetNumbersResponse } from "../models/models_0";
import { GetNumbers$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link GetNumbersCommand}.
 */
export interface GetNumbersCommandInput extends GetNumbersRequest {}
/**
 * @public
 *
 * The output of {@link GetNumbersCommand}.
 */
export interface GetNumbersCommandOutput extends GetNumbersResponse, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { XYZServiceClient, GetNumbersCommand } from "xyz-schema"; // ES Modules import
 * // const { XYZServiceClient, GetNumbersCommand } = require("xyz-schema"); // CommonJS import
 * // import type { XYZServiceClientConfig } from "xyz-schema";
 * const config = {}; // type is XYZServiceClientConfig
 * const client = new XYZServiceClient(config);
 * const input = { // GetNumbersRequest
 *   bigDecimal: Number("bigdecimal"),
 *   bigInteger: Number("bigint"),
 *   fieldWithoutMessage: "STRING_VALUE",
 *   fieldWithMessage: "STRING_VALUE",
 *   startToken: "STRING_VALUE",
 *   maxResults: Number("int"),
 *   customHeaderInput: "STRING_VALUE",
 *   numbers: { // IntegerMap
 *     "<keys>": Number("int"),
 *   },
 *   sparseNumbers: { // SparseIntegerMap
 *     "<keys>": Number("int"),
 *   },
 * };
 * const command = new GetNumbersCommand(input);
 * const response = await client.send(command);
 * // { // GetNumbersResponse
 * //   bigDecimal: Number("bigdecimal"),
 * //   bigInteger: Number("bigint"),
 * //   numbers: [ // IntegerList
 * //     Number("int"),
 * //   ],
 * //   sparseNumbers: [ // SparseIntegerList
 * //     Number("int"),
 * //   ],
 * //   nextToken: "STRING_VALUE",
 * //   deprecatedNumbers: [
 * //     Number("int"),
 * //   ],
 * //   deprecatedNumbersWithoutExplanation: [
 * //     Number("int"),
 * //   ],
 * //   deprecatedNumbersWithoutChronology: [
 * //     Number("int"),
 * //   ],
 * //   inexplicablyDeprecatedNumbers: [
 * //     Number("int"),
 * //   ],
 * // };
 *
 * ```
 *
 * @param GetNumbersCommandInput - {@link GetNumbersCommandInput}
 * @returns {@link GetNumbersCommandOutput}
 * @see {@link GetNumbersCommandInput} for command's `input` shape.
 * @see {@link GetNumbersCommandOutput} for command's `response` shape.
 * @see {@link XYZServiceClientResolvedConfig | config} for XYZServiceClient's `config` shape.
 *
 * @throws {@link CodedThrottlingError} (client fault)
 *
 * @throws {@link MysteryThrottlingError} (client fault)
 *
 * @throws {@link RetryableError} (client fault)
 *
 * @throws {@link HaltError} (client fault)
 *
 * @throws {@link XYZServiceServiceException} (client fault)
 *
 * @throws {@link MainServiceLinkedError} (client fault)
 *
 * @throws {@link XYZServiceSyntheticServiceException}
 * <p>Base exception class for all service exceptions from XYZService service.</p>
 *
 *
 */
export class GetNumbersCommand extends command<GetNumbersCommandInput, GetNumbersCommandOutput>(
  _ep1,
  _mw0,
  "GetNumbers",
  GetNumbers$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: GetNumbersRequest;
      output: GetNumbersResponse;
    };
    sdk: {
      input: GetNumbersCommandInput;
      output: GetNumbersCommandOutput;
    };
  };
}
