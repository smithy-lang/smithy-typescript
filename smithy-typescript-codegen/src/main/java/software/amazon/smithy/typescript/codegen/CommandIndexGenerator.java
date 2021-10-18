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

import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates an index to export the each command.
 */
@SmithyInternalApi
final class CommandIndexGenerator {

    private CommandIndexGenerator() {}

    static void writeIndex(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        FileManifest fileManifest
    ) {
        TypeScriptWriter writer = new TypeScriptWriter("");
        writeCommandExports(settings, model, symbolProvider, writer, fileManifest);
        fileManifest.writeFile(CodegenUtils.SOURCE_FOLDER + "/commands/index.ts", writer.toString());
    }

    private static void writeCommandExports(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer,
            FileManifest fileManifest
    ) {
        ServiceShape service = settings.getService(model);

        // write export statements for each command
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> containedOperations = new TreeSet<>(topDownIndex.getContainedOperations(service));
        for (OperationShape operation : containedOperations) {
            writer.write("export * from \"./$L\";", symbolProvider.toSymbol(operation).getName());
        }
    }
}
