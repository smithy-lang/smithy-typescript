/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.protocols;

import java.util.List;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.typescript.codegen.protocols.cbor.SmithyRpcV2Cbor;
import software.amazon.smithy.utils.ListUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Adds Smithy protocols.
 */
@SmithyInternalApi
public class AddProtocols implements TypeScriptIntegration {

    @Override
    public List<ProtocolGenerator> getProtocolGenerators() {
        return ListUtils.of(new SmithyRpcV2Cbor());
    }
}
