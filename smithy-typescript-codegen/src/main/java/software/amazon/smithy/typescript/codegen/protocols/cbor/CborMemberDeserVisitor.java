/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols.cbor;

import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.integration.DocumentMemberDeserVisitor;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

public class CborMemberDeserVisitor extends DocumentMemberDeserVisitor {

    /**
     * Constructor.
     *
     * @param context                The generation context.
     * @param dataSource             The in-code location of the data to provide an output of
     *                               ({@code output.foo}, {@code entry}, etc.)
     * @param defaultTimestampFormat The default timestamp format used in absence
     *                               of a TimestampFormat trait.
     */
    public CborMemberDeserVisitor(ProtocolGenerator.GenerationContext context,
                                  String dataSource,
                                  TimestampFormatTrait.Format defaultTimestampFormat) {
        super(context, dataSource, defaultTimestampFormat);
        context.getWriter().addImport("_json", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
        this.serdeElisionEnabled = !context.getSettings().generateServerSdk();
    }
}
