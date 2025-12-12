/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

/**
 * A container for packages.
 */
public interface PackageContainer {
    /**
     * Gets the name of the contained package.
     *
     * @return Returns the name of the package.
     */
    String getPackageName();
}
