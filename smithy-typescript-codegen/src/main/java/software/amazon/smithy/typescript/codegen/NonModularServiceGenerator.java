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

import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.utils.StringUtils;

/**
 * Generates a non-modular service client.
 *
 * <p>This client extends from the modular client and provides named methods
 * for every operation in the service. Using this client means that all
 * operations of a service are considered referenced, meaning they will
 * not be removed by tree-shaking.
 */
final class NonModularServiceGenerator implements Runnable {

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final SymbolProvider symbolProvider;
    private final TypeScriptWriter writer;
    private final String nonModularName;
    private final Symbol serviceSymbol;
    private final ApplicationProtocol applicationProtocol;

    NonModularServiceGenerator(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            String nonModularName,
            TypeScriptWriter writer,
            ApplicationProtocol applicationProtocol
    ) {
        this.settings = settings;
        this.model = model;
        this.service = settings.getService(model);
        this.symbolProvider = symbolProvider;
        this.writer = writer;
        this.nonModularName = nonModularName;
        this.applicationProtocol = applicationProtocol;
        serviceSymbol = symbolProvider.toSymbol(service);
    }

    @Override
    public void run() {
        TopDownIndex topDownIndex = model.getKnowledge(TopDownIndex.class);

        // Generate the client and extend from the modular client.
        writer.writeShapeDocs(service);
        writer.openBlock("export class $L extends $T {", "}", nonModularName, serviceSymbol, () -> {
            for (OperationShape operation : topDownIndex.getContainedOperations(service)) {
                Symbol operationSymbol = symbolProvider.toSymbol(operation);
                Symbol input = operationSymbol.expectProperty("inputType", Symbol.class);
                Symbol output = operationSymbol.expectProperty("outputType", Symbol.class);

                writer.addUseImports(operationSymbol);
                String methodName = StringUtils.uncapitalize(
                        operationSymbol.getName().replaceAll("Command$", "")
                );

                // Generate a multiple overloaded methods for each command.
                writer.writeShapeDocs(operation);
                writer.write("public $L(\n"
                            + "  args: $T,\n"
                            + "  options?: $T,\n"
                            + "): Promise<$T>;", methodName, input, applicationProtocol.getOptionsType(), output);
                writer.write("public $L(\n"
                             + "  args: $T,\n"
                             + "  cb: (err: any, data?: $T) => void\n"
                             + "): void;", methodName, input, output);
                writer.write("public $L(\n"
                            + "  args: $T,\n"
                            + "  options: $T,\n"
                            + "  cb: (err: any, data?: $T) => void\n"
                            + "): void;", methodName, input, applicationProtocol.getOptionsType(), output);
                writer.openBlock("public $1L(\n"
                                 + "  args: $2T,\n"
                                 + "  optionsOrCb?: $3T | ((err: any, data?: $4T) => void),\n"
                                 + "  cb?: (err: any, data?: $4T) => void\n"
                                 + "): Promise<$4T> | void { ", "}",
                        methodName,
                        input,
                        applicationProtocol.getOptionsType(),
                        output,
                        () -> {
                    writer.write("const command = new $T(args);\n"
                                 + "if (typeof optionsOrCb === \"function\") {\n"
                                 + "  this.send(command, optionsOrCb)\n"
                                 + "} else if (typeof cb === \"function\") {\n"
                                 + "  if (typeof optionsOrCb !== \"object\")\n"
                                 + "    throw new Error(`Expect http options but get $${typeof optionsOrCb}`)\n"
                                 + "  this.send(command, optionsOrCb || {}, cb)\n"
                                 + "} else {\n"
                                 + "  return this.send(command, optionsOrCb);\n"
                                 + "}", operationSymbol);
                });
                writer.write("");
            }
        });
    }
}
