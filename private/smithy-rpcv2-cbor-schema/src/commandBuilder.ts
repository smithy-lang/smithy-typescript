// smithy-typescript generated code
import { makeBuilder } from "@smithy/core/client";
import { getEndpointPlugin } from "@smithy/core/endpoints";

import { commonParams } from "./endpoint/EndpointParameters";
import type { RpcV2ProtocolClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "./RpcV2ProtocolClient";


/**
 * @internal
 */
export const command = makeBuilder<RpcV2ProtocolClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>(commonParams, "RpcV2Protocol", "RpcV2ProtocolClient", getEndpointPlugin);

/**
 * @internal
 */
export const _ep0 = {};

/**
 * @internal
 */
export const _mw0 = (Command: any, cs: any, config: any, o: any) => [
];
