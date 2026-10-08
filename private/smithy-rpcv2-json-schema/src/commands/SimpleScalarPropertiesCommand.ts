// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { SimpleScalarStructure } from "../models/models_0";
import { SimpleScalarProperties$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link SimpleScalarPropertiesCommand}.
 */
export interface SimpleScalarPropertiesCommandInput extends SimpleScalarStructure {}
/**
 * @public
 *
 * The output of {@link SimpleScalarPropertiesCommand}.
 */
export interface SimpleScalarPropertiesCommandOutput extends SimpleScalarStructure, __MetadataBearer {}

/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { RpcV2JsonProtocolClient, SimpleScalarPropertiesCommand } from "@smithy/smithy-rpcv2-json-schema"; // ES Modules import
 * // const { RpcV2JsonProtocolClient, SimpleScalarPropertiesCommand } = require("@smithy/smithy-rpcv2-json-schema"); // CommonJS import
 * // import type { RpcV2JsonProtocolClientConfig } from "@smithy/smithy-rpcv2-json-schema";
 * const config = {}; // type is RpcV2JsonProtocolClientConfig
 * const client = new RpcV2JsonProtocolClient(config);
 * const input = { // SimpleScalarStructure
 *   trueBooleanValue: true || false,
 *   falseBooleanValue: true || false,
 *   byteValue: 0, // BYTE_VALUE
 *   doubleValue: Number("double"),
 *   floatValue: Number("float"),
 *   integerValue: Number("int"),
 *   longValue: Number("long"),
 *   shortValue: Number("short"),
 *   stringValue: "STRING_VALUE",
 *   blobValue: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 * };
 * const command = new SimpleScalarPropertiesCommand(input);
 * const response = await client.send(command);
 * // { // SimpleScalarStructure
 * //   trueBooleanValue: true || false,
 * //   falseBooleanValue: true || false,
 * //   byteValue: 0, // BYTE_VALUE
 * //   doubleValue: Number("double"),
 * //   floatValue: Number("float"),
 * //   integerValue: Number("int"),
 * //   longValue: Number("long"),
 * //   shortValue: Number("short"),
 * //   stringValue: "STRING_VALUE",
 * //   blobValue: new Uint8Array(),
 * // };
 *
 * ```
 *
 * @param SimpleScalarPropertiesCommandInput - {@link SimpleScalarPropertiesCommandInput}
 * @returns {@link SimpleScalarPropertiesCommandOutput}
 * @see {@link SimpleScalarPropertiesCommandInput} for command's `input` shape.
 * @see {@link SimpleScalarPropertiesCommandOutput} for command's `response` shape.
 * @see {@link RpcV2JsonProtocolClientResolvedConfig | config} for RpcV2JsonProtocolClient's `config` shape.
 *
 * @throws {@link RpcV2JsonProtocolServiceException}
 * <p>Base exception class for all service exceptions from RpcV2JsonProtocol service.</p>
 *
 *
 */
export class SimpleScalarPropertiesCommand extends command<SimpleScalarPropertiesCommandInput, SimpleScalarPropertiesCommandOutput>(
  _ep0,
  _mw0,
  "SimpleScalarProperties",
  SimpleScalarProperties$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: SimpleScalarStructure;
      output: SimpleScalarStructure;
    };
    sdk: {
      input: SimpleScalarPropertiesCommandInput;
      output: SimpleScalarPropertiesCommandOutput;
    };
  };
}
