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
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;

/**
 * Generates an index to export the service client and each command.
 */
final class IndexGenerator {

    private IndexGenerator() {}

    static void writeIndex(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        FileManifest fileManifest
    ) {
        TypeScriptWriter writer = new TypeScriptWriter("");
        ServiceShape service = settings.getService(model);
        Symbol symbol = symbolProvider.toSymbol(service);

        // Write export statement for modular client
        writer.write("export * from \"./" + symbol.getName() + "\";");

        // Get non-modular client and write its export statement
        String nonModularName = symbol.getName().replace("Client", "");
        writer.write("export * from \"./" + nonModularName + "\";");

        // write export statements for each command in /commands directory
        TopDownIndex topDownIndex = model.getKnowledge(TopDownIndex.class);
        Set<OperationShape> containedOperations = new TreeSet<>(topDownIndex.getContainedOperations(service));
        for (OperationShape operation : containedOperations) {
            writer.write("export * from \"./commands/" + symbolProvider.toSymbol(operation).getName() + "\";");
        }

        // write export statement for models
        writer.write("export * from \"./models/index\";");
        fileManifest.writeFile("index.ts", writer.toString());
    }
}
