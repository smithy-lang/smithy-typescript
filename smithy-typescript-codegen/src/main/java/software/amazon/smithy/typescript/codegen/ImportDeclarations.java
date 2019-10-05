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

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Internal class used for aggregating imports of a file.
 */
final class ImportDeclarations {

    private final Path relativize;
    private final Map<String, Map<String, String>> imports = new TreeMap<>();

    ImportDeclarations(String relativize) {
        if (!relativize.startsWith("./")) {
            relativize = "./" + relativize;
        }

        // Strip off the filename of what's being relativized since it isn't needed.
        this.relativize = Paths.get(relativize).getParent();
    }

    ImportDeclarations addImport(String name, String alias, String module) {
        if (alias == null || alias.isEmpty()) {
            alias = name;
        }

        if (relativize != null && module.startsWith(".")) {
            // A relative import is resolved against the current file.
            module = relativize.relativize(Paths.get(module)).toString();
            if (!module.startsWith(".")) {
                module = "./" + module;
            }
        }

        if (!module.isEmpty() && (relativize == null || !module.equals(relativize.toString()))) {
            imports.computeIfAbsent(module, m -> new TreeMap<>()).put(alias, name);
        }

        return this;
    }

    @Override
    public String toString() {
        StringBuilder result = new StringBuilder();

        if (!imports.isEmpty()) {
            for (Map.Entry<String, Map<String, String>> entry : imports.entrySet()) {
                String module = entry.getKey();
                Map<String, String> moduleImports = entry.getValue();
                List<Map.Entry<String, String>> nonStarEntries = new ArrayList<>(moduleImports.entrySet());

                // "*" imports must be special-cased and can't be joined with named imports, and
                // remove "*" imports from nonStarEntries which is iterated afterwards.
                for (Map.Entry<String, String> importEntry : moduleImports.entrySet()) {
                    if (importEntry.getValue().equals("*")) {
                        nonStarEntries.remove(importEntry);
                        result.append("import ")
                                .append(createImportStatement(importEntry))
                                .append(" from \"")
                                .append(module)
                                .append("\";\n");
                    }
                }

                if (nonStarEntries.size() == 1) {
                    result.append("import { ")
                            .append(createImportStatement(nonStarEntries.get(0)))
                            .append(" } from \"")
                            .append(module)
                            .append("\";\n");
                } else if (!nonStarEntries.isEmpty()) {
                    result.append("import {\n");
                    for (Map.Entry<String, String> importEntry : nonStarEntries) {
                        result.append("  ");
                        result.append(createImportStatement(importEntry));
                        result.append(",\n");
                    }
                    result.append("} from \"").append(module).append("\";\n");
                }
            }
            result.append("\n");
        }

        return result.toString();
    }

    private static String createImportStatement(Map.Entry<String, String> entry) {
        return entry.getKey().equals(entry.getValue())
               ? entry.getKey()
               : entry.getValue() + " as " + entry.getKey();
    }
}
