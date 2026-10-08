// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { RecursiveShapesInputOutput } from "../models/models_0";
import { RecursiveShapes$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link RecursiveShapesCommand}.
 */
export interface RecursiveShapesCommandInput extends RecursiveShapesInputOutput {}
/**
 * @public
 *
 * The output of {@link RecursiveShapesCommand}.
 */
export interface RecursiveShapesCommandOutput extends RecursiveShapesInputOutput, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2JsonProtocolClient, RecursiveShapesCommand } from "@smithy/smithy-rpcv2-json-schema"; // ES Modules import
 * // const { RpcV2JsonProtocolClient, RecursiveShapesCommand } = require("@smithy/smithy-rpcv2-json-schema"); // CommonJS import
 * // import type { RpcV2JsonProtocolClientConfig } from "@smithy/smithy-rpcv2-json-schema";
 * const config = {}; // type is RpcV2JsonProtocolClientConfig
 * const client = new RpcV2JsonProtocolClient(config);
 * const input = { // RecursiveShapesInputOutput
 *   nested: { // RecursiveShapesInputOutputNested1
 *     foo: "STRING_VALUE",
 *     nested: { // RecursiveShapesInputOutputNested2
 *       bar: "STRING_VALUE",
 *       recursiveMember: {
 *         foo: "STRING_VALUE",
 *         nested: {
 *           bar: "STRING_VALUE",
 *           recursiveMember: "<RecursiveShapesInputOutputNested1>",
 *         },
 *       },
 *     },
 *   },
 * };
 * const command = new RecursiveShapesCommand(input);
 * const response = await client.send(command);
 * // { // RecursiveShapesInputOutput
 * //   nested: { // RecursiveShapesInputOutputNested1
 * //     foo: "STRING_VALUE",
 * //     nested: { // RecursiveShapesInputOutputNested2
 * //       bar: "STRING_VALUE",
 * //       recursiveMember: {
 * //         foo: "STRING_VALUE",
 * //         nested: {
 * //           bar: "STRING_VALUE",
 * //           recursiveMember: "<RecursiveShapesInputOutputNested1>",
 * //         },
 * //       },
 * //     },
 * //   },
 * // };
 *
 * ```
 *
 * @param RecursiveShapesCommandInput - {@link RecursiveShapesCommandInput}
 * @returns {@link RecursiveShapesCommandOutput}
 * @see {@link RecursiveShapesCommandInput} for command's `input` shape.
 * @see {@link RecursiveShapesCommandOutput} for command's `response` shape.
 * @see {@link RpcV2JsonProtocolClientResolvedConfig | config} for RpcV2JsonProtocolClient's `config` shape.
 *
 * @throws {@link RpcV2JsonProtocolServiceException}
 * <p>Base exception class for all service exceptions from RpcV2JsonProtocol service.</p>
 *
 *
 */
export class RecursiveShapesCommand extends command<RecursiveShapesCommandInput, RecursiveShapesCommandOutput>(
  _ep0,
  _mw0,
  "RecursiveShapes",
  RecursiveShapes$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: RecursiveShapesInputOutput;
      output: RecursiveShapesInputOutput;
    };
    sdk: {
      input: RecursiveShapesCommandInput;
      output: RecursiveShapesCommandOutput;
    };
  };
}
