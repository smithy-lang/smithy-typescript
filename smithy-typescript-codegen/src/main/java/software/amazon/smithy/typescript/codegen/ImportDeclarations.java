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
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
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
    private final Map<String, Map<String, String>> namedTypeImports = new TreeMap<>();

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

    ImportDeclarations addTypeImport(String name, String alias, String module) {
        if (alias == null || alias.isEmpty()) {
            alias = name;
        }
        module = getRelativizedModule(relativize, module);
        if (!module.isEmpty() && (relativize == null || !module.equals(relativize.toString()))) {
            namedTypeImports.computeIfAbsent(module, m -> new TreeMap<>()).put(alias, name);
        }
        return this;
    }

    @Override
    public void importSymbol(Symbol symbol, String alias) {
        if (!symbol.getNamespace().isEmpty() && !symbol.getNamespace().equals(moduleNameString)) {
            if (
                symbol
                    .getProperty("typeOnly")
                    .map(o -> (Boolean) o)
                    .orElse(false)
            ) {
                addTypeImport(symbol.getName(), alias, symbol.getNamespace());
            } else {
                addImport(symbol.getName(), alias, symbol.getNamespace());
            }
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
                result
                    .append("import ")
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

        createImports(namedImports, namedTypeImports, result);

        return result.toString();
    }

    private static void createImports(
        Map<String, Map<String, String>> namedImports,
        Map<String, Map<String, String>> namedTypeImports,
        StringBuilder buffer
    ) {
        TreeSet<String> mergedModuleKeys = new TreeSet<>((a, b) -> {
            if (a.startsWith(".") && !b.startsWith(".")) {
                return 1;
            }
            if (!a.startsWith(".") && b.startsWith(".")) {
                return -1;
            }
            if (a.equalsIgnoreCase(b)) {
                return a.compareTo(b);
            }
            return a.toLowerCase().compareTo(b.toLowerCase());
        });
        mergedModuleKeys.addAll(namedImports.keySet());
        mergedModuleKeys.addAll(namedTypeImports.keySet());

        // separate non-relative and relative imports.
        long separatorIndex = mergedModuleKeys
            .stream()
            .filter(k -> !k.startsWith("."))
            .count();
        int i = 0;
        boolean needsSeparator = separatorIndex > 0 && separatorIndex < mergedModuleKeys.size();

        for (String module : mergedModuleKeys) {
            if (i++ == separatorIndex && needsSeparator) {
                buffer.append("\n");
            }
            Map<String, String> moduleImports = namedImports.getOrDefault(module, Collections.emptyMap());
            Map<String, String> typeImports = namedTypeImports.getOrDefault(module, Collections.emptyMap());

            TreeSet<String> mergedSymbolKeys = new TreeSet<>();
            mergedSymbolKeys.addAll(moduleImports.keySet());
            mergedSymbolKeys.addAll(typeImports.keySet());

            Set<String> imports = new TreeSet<>((a, b) -> {
                boolean aType = a.startsWith("type ");
                boolean bType = b.startsWith("type ");
                if (aType && !bType) {
                    return -1;
                }
                if (!aType && bType) {
                    return 1;
                }
                String normalA = a.replaceAll("(type )|( as (.*?))", "");
                String normalB = b.replaceAll("(type )|( as (.*?))", "");
                if (normalA.equals(normalB)) {
                    return a.compareTo(b);
                }
                return normalA.compareTo(normalB);
            });

            for (String alias : mergedSymbolKeys) {
                String runtimeSymbol = moduleImports.get(alias);
                String typeSymbol = typeImports.get(alias);

                // "*" imports are not supported https://github.com/smithy-lang/smithy-typescript/issues/211
                if ("*".equals(runtimeSymbol) || "*".equals(typeSymbol)) {
                    throw new CodegenException(
                        "Star imports are not supported, attempted for " + module + ". Use default import instead."
                    );
                }

                if (runtimeSymbol != null) {
                    if (!alias.equals(runtimeSymbol)) {
                        imports.add("%s as %s".formatted(runtimeSymbol, alias));
                    } else {
                        imports.add(runtimeSymbol);
                    }
                } else if (typeSymbol != null) {
                    if (!alias.equals(typeSymbol)) {
                        imports.add("type %s as %s".formatted(typeSymbol, alias));
                    } else {
                        imports.add("type " + typeSymbol);
                    }
                }
            }

            if (!imports.isEmpty()) {
                String inline;
                String multiline;

                String head;
                String symbols;
                String tail = "\";\n";
                boolean allImportsAreTypes = imports.stream().allMatch(s -> s.startsWith("type "));
                {
                    head = "import { ";
                    symbols = String.join(", ", imports);
                    String source = " } from \"" + module;
                    if (allImportsAreTypes) {
                        head = head.replace("import ", "import type ");
                        symbols = symbols.replaceAll("type ", "");
                    }
                    inline = head + symbols + source + tail;
                }
                {
                    head = "import {\n  ";
                    symbols = String.join(",\n  ", imports);
                    String source = ",\n} from \"" + module;
                    if (allImportsAreTypes) {
                        head = head.replace("import ", "import type ");
                        symbols = symbols.replaceAll("type ", "");
                    }
                    multiline = head + symbols + source + tail;
                }
                if (inline.trim().length() <= TypeScriptWriter.LINE_WIDTH) {
                    buffer.append(inline);
                } else {
                    buffer.append(multiline);
                }
            }
        }
        if (!namedImports.isEmpty() || !namedTypeImports.isEmpty()) {
            buffer.append("\n");
        }
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
