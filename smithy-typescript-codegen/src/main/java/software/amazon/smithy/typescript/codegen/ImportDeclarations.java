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

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.ImportContainer;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.utils.Pair;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Internal class used for aggregating imports of a file.
 */
@SmithyInternalApi
final class ImportDeclarations implements ImportContainer {

    private final String moduleNameString;
    private final String relativize;
    private final Map<String, Pair<String, Ignore>> defaultImports = new TreeMap<>();
    private final Map<String, Map<String, String>> namedImports = new TreeMap<>();

    ImportDeclarations(String relativize) {
        relativize = relativize.replace(File.separatorChar, '/');
        if (!relativize.startsWith("./")) {
            relativize = "./" + relativize;
        }
        this.moduleNameString = relativize;

        // Strip off the filename of what's being relativized since it isn't needed.
        Path relativizePath = Paths.get(relativize).getParent();
        if (relativizePath == null) {
            this.relativize = null;
        } else {
            this.relativize = relativizePath.toString().replace(File.separatorChar, '/');
        }
    }

    ImportDeclarations addDefaultImport(String name, String module) {
        return addDefaultImport(name, module, Ignore.notIgnored());
    }

    ImportDeclarations addIgnoredDefaultImport(String name, String module, String reason) {
        return addDefaultImport(name, module, Ignore.ignored(reason));
    }

    private ImportDeclarations addDefaultImport(String name, String module, Ignore ignore) {
        module = getRelativizedModule(relativize, module);

        if (!module.isEmpty() && (relativize == null || !module.equals(relativize.toString()))) {
            defaultImports.put(module, new Pair<>(name, ignore));
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
    public void importSymbol(Symbol symbol, String alias) {
        if (!symbol.getNamespace().isEmpty() && !symbol.getNamespace().equals(moduleNameString)) {
            addImport(symbol.getName(), alias, symbol.getNamespace());
        }
    }

    @Override
    public String toString() {
        StringBuilder result = new StringBuilder();

        if (!defaultImports.isEmpty()) {
            for (Map.Entry<String, Pair<String, Ignore>> importEntry : defaultImports.entrySet()) {
                boolean ignore = importEntry.getValue().getRight().ignore;
                if (ignore) {
                    result.append("// @ts-ignore: ").append(importEntry.getValue().getRight().reason).append("\n");
                }
                result.append("import ")
                        .append(importEntry.getValue().getLeft())
                        .append(" from \"")
                        .append(importEntry.getKey())
                        .append("\";");
                if (ignore) {
                    result.append(" // eslint-disable-line");
                }
                result.append('\n');
            }
            result.append('\n');
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

    private static String getRelativizedModule(String relativize, String module) {
        if (relativize != null && module.startsWith(".")) {
            // A relative import is resolved against the current file.
            Path relativizePath = Paths.get(relativize);
            module = relativizePath.relativize(Paths.get(module)).toString().replace(File.separatorChar, '/');
            if (!module.startsWith(".")) {
                module = "./" + module;
            }
        }
        return module;
    }

    private static final class Ignore {
        final boolean ignore;
        final String reason;

        private Ignore(boolean ignore, String reason) {
            this.ignore = ignore;
            this.reason = reason;
        }

        static Ignore notIgnored() {
            return new Ignore(false, null);
        }

        static Ignore ignored(String reason) {
            return new Ignore(true, reason);
        }

    }
}
