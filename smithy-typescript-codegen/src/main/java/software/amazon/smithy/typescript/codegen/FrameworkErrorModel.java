/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import software.amazon.smithy.model.Model;
import software.amazon.smithy.utils.SmithyUnstableApi;

@SmithyUnstableApi
public enum FrameworkErrorModel {
    INSTANCE;

    private final Model model = Model.assembler()
        .addImport(FrameworkErrorModel.class.getResource("framework-errors.smithy"))
        .assemble()
        .unwrap();

    public Model getModel() {
        return model;
    }
}
