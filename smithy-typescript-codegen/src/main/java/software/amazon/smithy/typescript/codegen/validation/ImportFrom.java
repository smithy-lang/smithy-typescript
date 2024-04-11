/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.validation;

import java.util.Set;
import software.amazon.smithy.utils.SetUtils;

/**
 * Interprets the string portion of an import statement.
 */
public class ImportFrom {
    public static final Set<String> NODE_NATIVE_DEPENDENCIES = SetUtils.of(
        "buffer",
        "child_process",
        "crypto",
        "dns",
        "events",
        "fs",
        "http",
        "http2",
        "https",
        "os",
        "path",
        "process",
        "stream",
        "tls",
        "url",
        "util",
        "zlib"
    );

    private final String from;

    public ImportFrom(String importTargetExpression) {
        this.from = importTargetExpression;
    }

    /**
     * @return whether we recognize it as a Node.js native module. These
     * do not need to be declared in package.json, however this check
     * is not exhaustive as the true nature of a package depends on the
     * Node.js version.
     */
    public boolean isNodejsNative() {
        String[] packageNameSegments = from.split("/");
        return from.startsWith("node:")
            || NODE_NATIVE_DEPENDENCIES.contains(packageNameSegments[0]);
    }

    /**
     * @return whether the import has an org or namespace prefix like \@smithy/pkg.
     */
    public boolean isNamespaced() {
        return from.startsWith("@") && from.contains("/");
    }

    /**
     * @return whether the import starts with / or . indicating a relative import.
     * These would not be added to package.json dependencies.
     */
    public boolean isRelative() {
        return from.startsWith("/") || from.startsWith(".");
    }

    /**
     * @return whether the import should correspond to an entry in
     * package.json.
     */
    public boolean isDeclarablePackageImport() {
        return !isNodejsNative() && !isRelative();
    }

    /**
     * @return the package name. This excludes sub-paths of packages.
     *
     * For example in \@smithy/pkg/module the package name is \@smithy/pkg.
     */
    public String getPackageName() {
        String[] packageNameSegments = from.split("/");
        String packageName;
        if (isNodejsNative()) {
            packageName = packageNameSegments[0].substring("node:".length());
        } else if (isNamespaced()) {
            packageName = packageNameSegments[0] + "/" + packageNameSegments[1];
        } else {
            packageName = packageNameSegments[0];
        }
        return packageName;
    }
}
