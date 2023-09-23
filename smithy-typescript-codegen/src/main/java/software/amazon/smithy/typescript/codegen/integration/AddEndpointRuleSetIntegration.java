/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.integration;

import java.util.List;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptCodegenContext;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.sections.SmithyContextCodeSection;
import software.amazon.smithy.utils.CodeInterceptor;
import software.amazon.smithy.utils.CodeSection;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
public class AddEndpointRuleSetIntegration implements TypeScriptIntegration {
    @Override
    public List<? extends CodeInterceptor<? extends CodeSection, TypeScriptWriter>> interceptors(
        TypeScriptCodegenContext codegenContext
    ) {
        return List.of(CodeInterceptor.appender(SmithyContextCodeSection.class, (w, s) -> {
            if (s.getService().hasTrait(EndpointRuleSetTrait.ID)) {
                w.openBlock("endpointRuleSet: {", "},", () -> {
                    w.write("getEndpointParameterInstructions: $T.getEndpointParameterInstructions,",
                        codegenContext.symbolProvider().toSymbol(s.getOperation()));
                });
            }
        }));
    }
}
