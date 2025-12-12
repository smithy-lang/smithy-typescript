/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;

import java.util.List;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolDependency;

public class TypeScriptDependencyTest {

    @Test
    public void createsSymbols() {
        Symbol foo = TypeScriptDependency.AWS_SDK_HASH_NODE.createSymbol("Foo");

        assertThat(foo.getNamespace(), equalTo(TypeScriptDependency.AWS_SDK_HASH_NODE.packageName));
        assertThat(foo.getName(), equalTo("Foo"));
        assertThat(foo.getDependencies(), contains(TypeScriptDependency.AWS_SDK_HASH_NODE.dependency));
    }

    @Test
    public void getsUnconditionalDependencies() {
        assertThat(
            TypeScriptDependency.getUnconditionalDependencies(),
            hasItem(TypeScriptDependency.SMITHY_TYPES.dependency)
        );
    }

    @Test
    public void getsVendedDependencyVersions() {
        List<SymbolDependency> smithyTypes = TypeScriptDependency.SMITHY_TYPES.getDependencies();
        List<SymbolDependency> serverCommon = TypeScriptDependency.SERVER_COMMON.getDependencies();

        assertThat(smithyTypes.size(), equalTo(1));
        assertThat(smithyTypes.get(0).getVersion(), startsWith("^"));
        assertThat(smithyTypes.get(0).getPackageName(), equalTo("@smithy/types"));

        assertThat(serverCommon.size(), equalTo(1));
        assertThat(serverCommon.get(0).getVersion(), not(startsWith("^")));
        assertThat(serverCommon.get(0).getPackageName(), equalTo("@aws-smithy/server-common"));
    }
}
