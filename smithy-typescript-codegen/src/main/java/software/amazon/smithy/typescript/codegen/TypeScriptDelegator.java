/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
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
