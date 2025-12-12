/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.codegen.core.SymbolProvider;

public class TypeScriptDelegatorTest {

    @Test
    public void addsBuiltinDependencies() {
        SymbolProvider provider = shape -> null;
        MockManifest manifest = new MockManifest();
        TypeScriptDelegator delegator = new TypeScriptDelegator(manifest, provider);

        assertThat(delegator.getDependencies(), equalTo(TypeScriptDependency.getUnconditionalDependencies()));
    }
}
