/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.util;

import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.sections.CommandConstructorCodeSection;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * The writer consumer for a RuntimeClientPlugin. May be used to add imports and dependencies used
 * by the plugin at the command level.
 */
@FunctionalInterface
@SmithyInternalApi
public interface CommandWriterConsumer {
  void accept(TypeScriptWriter writer, CommandConstructorCodeSection section);
}
