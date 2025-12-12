/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.util.ArrayList;
import java.util.List;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.WriterDelegator;
import software.amazon.smithy.utils.SmithyUnstableApi;

@SmithyUnstableApi
public final class TypeScriptDelegator extends WriterDelegator<TypeScriptWriter> {

    TypeScriptDelegator(FileManifest fileManifest, SymbolProvider symbolProvider) {
        super(fileManifest, symbolProvider, new TypeScriptWriter.TypeScriptWriterFactory());
    }

    /**
     * Gets all of the dependencies that have been registered in writers owned by the delegator, along with any
     * unconditional dependencies.
     *
     * @return Returns all the dependencies.
     */
    @Override
    public List<SymbolDependency> getDependencies() {
        // Always add unconditional dependencies.
        List<SymbolDependency> resolved = new ArrayList<>(TypeScriptDependency.getUnconditionalDependencies());
        resolved.addAll(super.getDependencies());
        return resolved;
    }
}
