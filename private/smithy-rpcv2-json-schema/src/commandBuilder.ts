// smithy-typescript generated code
import { makeBuilder } from "@smithy/core/client";
import { getEndpointPlugin } from "@smithy/core/endpoints";
import type { EndpointParameterInstructions } from "@smithy/types";

import { commonParams } from "./endpoint/EndpointParameters";
import type {
  RpcV2JsonProtocolClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "./RpcV2JsonProtocolClient";


/**
 * @internal
 */
export const command = makeBuilder<RpcV2JsonProtocolClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>(commonParams, "RpcV2JsonProtocol", "RpcV2JsonProtocolClient", getEndpointPlugin);

/**
 * @internal
 */
export const _ep0: EndpointParameterInstructions = {};

/**
 * @internal
 */
export const _mw0 = (Command: any, cs: any, config: any, o: any) => [
];
