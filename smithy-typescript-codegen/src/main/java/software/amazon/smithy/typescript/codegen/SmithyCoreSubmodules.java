/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

/**
 * This is an enum-like submodule list to be used with
 *
 * TypeScriptWriter::addImportSubmodule(
 *   Dependency == "cbor",
 *   null (no alias),
 *   PackageContainer == "@smithy/core",
 *   SmithyCoreSubmodules.CBOR == "/cbor"
 * );
 *
 * The intended result is e.g.
 * ```ts
 * import { cbor } from "@smithy/core/cbor";
 * ```
 */
public final class SmithyCoreSubmodules {
    public static final String CBOR = "/cbor";

    private SmithyCoreSubmodules() {}
}
