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
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import software.amazon.smithy.codegen.core.CodegenException;

/**
 * Internal class used for aggregating imports of a file.
 */
final class ImportDeclarations {

    private final Path relativize;
    private final Map<String, String> defaultImports = new TreeMap<>();
    private final Map<String, Map<String, String>> namedImports = new TreeMap<>();

    ImportDeclarations(String relativize) {
        if (!relativize.startsWith("./")) {
            relativize = "./" + relativize;
        }

        // Strip off the filename of what's being relativized since it isn't needed.
        this.relativize = Paths.get(relativize).getParent();
    }

    ImportDeclarations addDefaultImport(String name, String module) {
        module = getRelativizedModule(relativize, module);

        if (!module.isEmpty() && (relativize == null || !module.equals(relativize.toString()))) {
            defaultImports.put(module, name);
        }

        return this;
    }

    ImportDeclarations addImport(String name, String alias, String module) {
        if (alias == null || alias.isEmpty()) {
            alias = name;
        }

        module = getRelativizedModule(relativize, module);

        if (!module.isEmpty() && (relativize == null || !module.equals(relativize.toString()))) {
            namedImports.computeIfAbsent(module, m -> new TreeMap<>()).put(alias, name);
        }

        return this;
    }

    @Override
    public String toString() {
        StringBuilder result = new StringBuilder();

        if (!defaultImports.isEmpty()) {
            for (Map.Entry<String, String> importEntry : defaultImports.entrySet()) {
                result.append("import ")
                        .append(importEntry.getValue())
                        .append(" from \"")
                        .append(importEntry.getKey())
                        .append("\";\n");
            }
            result.append("\n");
        }

        if (!namedImports.isEmpty()) {
            for (Map.Entry<String, Map<String, String>> entry : namedImports.entrySet()) {
                String module = entry.getKey();
                Map<String, String> moduleImports = entry.getValue();
                Set<Map.Entry<String, String>> entries = moduleImports.entrySet();

                // "*" imports are not supported https://github.com/awslabs/smithy-typescript/issues/211
                for (Map.Entry<String, String> importEntry : entries) {
                    if (importEntry.getValue().equals("*")) {
                        throw new CodegenException("Star imports are not supported, attempted for " + module
                                + ". Use default import instead.");
                    }
                }

                if (entries.size() == 1) {
                    result.append("import { ")
                            .append(createImportStatement(entries.iterator().next()))
                            .append(" } from \"")
                            .append(module)
                            .append("\";\n");
                } else if (!entries.isEmpty()) {
                    result.append("import {\n");
                    for (Map.Entry<String, String> importEntry : entries) {
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

    private static String getRelativizedModule(Path relativize, String module) {
        if (relativize != null && module.startsWith(".")) {
            // A relative import is resolved against the current file.
            module = relativize.relativize(Paths.get(module)).toString();
            if (!module.startsWith(".")) {
                module = "./" + module;
            }
        }
        return module;
    }
}
