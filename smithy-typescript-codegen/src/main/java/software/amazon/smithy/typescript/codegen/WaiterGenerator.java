/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.jmespath.JmespathExpression;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.knowledge.ServiceClosure;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.waiters.Acceptor;
import software.amazon.smithy.waiters.AcceptorState;
import software.amazon.smithy.waiters.Matcher;
import software.amazon.smithy.waiters.PathMatcher;
import software.amazon.smithy.waiters.WaitableTrait;
import software.amazon.smithy.waiters.Waiter;

@SmithyInternalApi
class WaiterGenerator implements Runnable {

    static final String WAITERS_FOLDER = "waiters";
    static final String WAITER_SUBMODULE = SmithyCoreSubmodules.CLIENT;

    private final String waiterName;
    private final Waiter waiter;
    private final TypeScriptWriter writer;

    private final Symbol serviceSymbol;
    private final Symbol operationSymbol;
    private final Symbol inputSymbol;
    private final Symbol outputSymbol;
    private final String waiterResultType;
    private final String waitUntilResultType;

    WaiterGenerator(
        String waiterName,
        Waiter waiter,
        ServiceShape service,
        OperationShape operation,
        TypeScriptWriter writer,
        SymbolProvider symbolProvider,
        TypeScriptSettings settings,
        Model model
    ) {
        this.waiterName = waiterName;
        this.waiter = waiter;
        this.writer = writer;

        this.operationSymbol = symbolProvider.toSymbol(operation);
        this.serviceSymbol = symbolProvider.toSymbol(service)
            .toBuilder()
            .putProperty("typeOnly", true)
            .build();
        this.inputSymbol = operationSymbol.expectProperty("inputType", Symbol.class);
        this.outputSymbol = operationSymbol.expectProperty("outputType", Symbol.class);

        String serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
        String syntheticBaseExceptionName = CodegenUtils.getSyntheticBaseExceptionName(serviceName, model);
        writer.addRelativeTypeImport(
            syntheticBaseExceptionName,
            null,
            Path.of(".", "src", "models", syntheticBaseExceptionName)
        );
        waiterResultType = outputSymbol.getName() + " | " + syntheticBaseExceptionName;
        waitUntilResultType = computeWaitUntilResultType(
            waiter,
            outputSymbol.getName(),
            syntheticBaseExceptionName,
            settings,
            model,
            symbolProvider,
            writer
        );
    }

    @Override
    public void run() {
        writer.addDependency(TypeScriptDependency.SMITHY_CORE);
        this.generateAcceptors();
        this.generateWaiter();
    }

    public static String getOutputFileLocation(String waiterName) {
        return Paths.get(CodegenUtils.SOURCE_FOLDER, WAITERS_FOLDER, "waitFor" + waiterName + ".ts").toString();
    }

    private void generateWaiter() {
        writer.addImportSubmodule("createWaiter", null, TypeScriptDependency.SMITHY_CORE, WAITER_SUBMODULE);
        writer.addTypeImportSubmodule("WaiterResult", null, TypeScriptDependency.SMITHY_CORE, WAITER_SUBMODULE);
        writer.addImportSubmodule("WaiterState", null, TypeScriptDependency.SMITHY_CORE, WAITER_SUBMODULE);
        writer.addImportSubmodule("checkExceptions", null, TypeScriptDependency.SMITHY_CORE, WAITER_SUBMODULE);
        writer.addTypeImportSubmodule("WaiterConfiguration", null, TypeScriptDependency.SMITHY_CORE, WAITER_SUBMODULE);

        // generates (deprecated) WaitFor....
        writer.writeDocs(
            waiter.getDocumentation().orElse("") +
                " \n" +
                " @deprecated Use waitUntil" +
                waiterName +
                " instead. " +
                "waitFor" +
                waiterName +
                " does not throw error in non-success cases."
        );
        writer.openBlock(
            """
            export const waitFor$L = async (
              params: WaiterConfiguration<$T>,
              input: $T
            ): Promise<WaiterResult<$L>> => {""",
            "};",
            waiterName,
            serviceSymbol,
            inputSymbol,
            waiterResultType,
            () -> {
                writer.write(
                    "const serviceDefaults = { minDelay: $L, maxDelay: $L };",
                    waiter.getMinDelay(),
                    waiter.getMaxDelay()
                );
                writer.write("return createWaiter({ ...serviceDefaults, ...params }, input, checkState);");
            }
        );

        // generates WaitUtil....
        writer.writeDocs(
            waiter.getDocumentation().orElse("") +
                " \n" +
                " @param params - Waiter configuration options.\n" +
                " @param input - The input to " +
                operationSymbol.getName() +
                " for polling."
        );
        writer.openBlock(
            """
            export const waitUntil$L = async (
              params: WaiterConfiguration<$T>,
              input: $T
            ): Promise<WaiterResult<$L>> => {""",
            "};",
            waiterName,
            serviceSymbol,
            inputSymbol,
            waitUntilResultType,
            () -> {
                writer.write(
                    "const serviceDefaults = { minDelay: $L, maxDelay: $L };",
                    waiter.getMinDelay(),
                    waiter.getMaxDelay()
                );
                writer.write(
                    "const result = await createWaiter({ ...serviceDefaults, ...params }, input, checkState);"
                );
                // as WaiterResult<Narrowed> is needed because createWaiter is the union type
                // whereas checkExceptions narrows to only the success type.
                writer.write("return checkExceptions(result) as WaiterResult<$L>;", waitUntilResultType);
            }
        );
    }

    private void generateAcceptors() {
        writer.openBlock(
            "const checkState = async (client: $T, input: $T): Promise<WaiterResult<$L>> => {",
            "};",
            serviceSymbol,
            inputSymbol,
            waiterResultType,
            () -> {
                writer.write("let reason;");

                writer.write("try {").indent();
                {
                    writer.write(
                        "let result: $T & any = await client.send(new $T(input));",
                        outputSymbol,
                        operationSymbol
                    );
                    writer.write("reason = result;");
                    writeAcceptors("result", false);
                }
                writer.dedent().write("} catch (exception) {").indent();
                {
                    writer.write("reason = exception;");
                    writeAcceptors("exception", true);
                }
                writer.dedent().write("}");

                writer.write("return $L;", makeWaiterResult(AcceptorState.RETRY));
            }
        );
    }

    private void writeAcceptors(String accessor, boolean isException) {
        waiter
            .getAcceptors()
            .forEach((Acceptor acceptor) -> {
                if (acceptor.getMatcher() instanceof Matcher.SuccessMember) {
                    Matcher.SuccessMember successMember = (Matcher.SuccessMember) acceptor.getMatcher();
                    if (successMember.getValue() != isException) {
                        generateSuccessMatcher(successMember, acceptor.getState());
                    }
                } else if (acceptor.getMatcher() instanceof Matcher.ErrorTypeMember) {
                    if (isException) {
                        generateErrorMatcher(
                            accessor,
                            (Matcher.ErrorTypeMember) acceptor.getMatcher(),
                            acceptor.getState()
                        );
                    }
                } else if (acceptor.getMatcher() instanceof Matcher.InputOutputMember) {
                    if (!isException) {
                        Matcher.InputOutputMember member = (Matcher.InputOutputMember) acceptor.getMatcher();
                        generatePathMatcher(accessor, member.getValue(), acceptor.getState());
                        generatePathMatcher("input", member.getValue(), acceptor.getState());
                    }
                } else if (acceptor.getMatcher() instanceof Matcher.OutputMember) {
                    if (!isException) {
                        Matcher.OutputMember member = (Matcher.OutputMember) acceptor.getMatcher();
                        generatePathMatcher(accessor, member.getValue(), acceptor.getState());
                    }
                } else {
                    throw new CodegenException(
                        "Unknown matcher member name: " + acceptor.getMatcher().getMemberName()
                    );
                }
            });
    }

    private void generateSuccessMatcher(Matcher.SuccessMember member, AcceptorState state) {
        writer.write("return $L;", makeWaiterResult(state));
    }

    private void generateErrorMatcher(String accessor, Matcher.ErrorTypeMember member, AcceptorState state) {
        writer.openBlock("if ($L.name === $S) {", "}", accessor, member.getValue(), () -> {
            writer.write("return $L;", makeWaiterResult(state));
        });
    }

    private void generatePathMatcher(String accessor, PathMatcher pathMatcher, AcceptorState state) {
        writer.openBlock("try {", "} catch (e) {}", () -> {
            JmespathExpression expression = JmespathExpression.parse(pathMatcher.getPath());
            TypeScriptJmesPathVisitor expressionVisitor = new TypeScriptJmesPathVisitor(writer, accessor, expression);
            String expectedState = makeWaiterResult(state);
            expressionVisitor.run();

            switch (pathMatcher.getComparator()) {
                case ALL_STRING_EQUALS:
                    expressionVisitor.writeAllStringEqualsExpectation(pathMatcher.getExpected(), expectedState);
                    break;
                case ANY_STRING_EQUALS:
                    expressionVisitor.writeAnyStringEqualsExpectation(pathMatcher.getExpected(), expectedState);
                    break;
                case STRING_EQUALS:
                    expressionVisitor.writeStringExpectation(pathMatcher.getExpected(), expectedState);
                    break;
                case BOOLEAN_EQUALS:
                    expressionVisitor.writeBooleanExpectation(pathMatcher.getExpected(), expectedState);
                    break;
                default:
                    throw new CodegenException("Invalid Matcher Comparator");
            }
        });
    }

    private String makeWaiterResult(AcceptorState resultantState) {
        if (resultantState == AcceptorState.SUCCESS) {
            return "{ state: WaiterState.SUCCESS, reason }";
        } else if (resultantState == AcceptorState.FAILURE) {
            return "{ state: WaiterState.FAILURE, reason }";
        } else if (resultantState == AcceptorState.RETRY) {
            return "{ state: WaiterState.RETRY, reason }";
        }
        throw new CodegenException("Hit an invalid acceptor state to codegen " + resultantState.toString());
    }

    private static String getModulePath(String fileLocation) {
        return fileLocation.substring(fileLocation.lastIndexOf("/") + 1, fileLocation.length()).replace(".ts", "");
    }

    /**
     * Determines the narrowest result type for waitUntil based on which acceptors
     * produce a SUCCESS state.
     *
     * - If success only comes from successful responses: OutputType only.
     * - If success only comes from errors: the specific modeled exception if there
     *   is exactly one ErrorType success acceptor matching a modeled error, otherwise
     *   the synthetic base exception.
     * - If success can come from both: OutputType | exception type.
     */
    static String computeWaitUntilResultType(
        Waiter waiter,
        String outputTypeName,
        String exceptionTypeName,
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer
    ) {
        boolean waiterSuccessTerminalOnSuccessfulResponse = false;
        boolean waiterSuccessTerminalOnErrorResponse = false;
        Set<String> successErrorTypeNames = new TreeSet<>();

        for (Acceptor acceptor : waiter.getAcceptors()) {
            if (acceptor.getState() != AcceptorState.SUCCESS) {
                continue;
            }
            Matcher<?> matcher = acceptor.getMatcher();
            if (matcher instanceof Matcher.SuccessMember successMember) {
                if (successMember.getValue()) {
                    waiterSuccessTerminalOnSuccessfulResponse = true;
                } else {
                    waiterSuccessTerminalOnErrorResponse = true;
                }
            } else if (matcher instanceof Matcher.ErrorTypeMember errorTypeMember) {
                waiterSuccessTerminalOnErrorResponse = true;
                successErrorTypeNames.add(errorTypeMember.getValue());
            } else if (
                matcher instanceof Matcher.OutputMember
                    || matcher instanceof Matcher.InputOutputMember
            ) {
                waiterSuccessTerminalOnSuccessfulResponse = true;
            }
        }

        String resolvedExceptionType = exceptionTypeName;
        if (successErrorTypeNames.size() == 1) {
            String errorName = successErrorTypeNames.iterator().next();
            boolean errorTypeQualifiedName = errorName.contains("#");

            // Check if this error is a modeled error shape on the operation.
            resolvedExceptionType = ServiceClosure.of(model, settings.getService(model))
                .getErrorShapes()
                .stream()
                .filter(
                    shape -> errorTypeQualifiedName ? ShapeId.from(errorName).equals(shape.getId())
                        : shape.getId().getName().equals(errorName)
                )
                .findFirst()
                .map(shape -> {
                    String typeName = symbolProvider.toSymbol(shape).getName();
                    writer.addRelativeTypeImport(
                        typeName,
                        null,
                        Path.of(".", "src", "models", "errors")
                    );
                    return typeName;
                })
                .orElse(exceptionTypeName);
        }

        if (waiterSuccessTerminalOnSuccessfulResponse && waiterSuccessTerminalOnErrorResponse) {
            return outputTypeName + " | " + resolvedExceptionType;
        } else if (waiterSuccessTerminalOnErrorResponse) {
            return resolvedExceptionType;
        }
        return outputTypeName;
    }

    static void writeIndex(Model model, ServiceShape service, FileManifest fileManifest) {
        TypeScriptWriter writer = new TypeScriptWriter("");

        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> containedOperations = new TreeSet<>(topDownIndex.getContainedOperations(service));
        for (OperationShape operation : containedOperations) {
            if (operation.hasTrait(WaitableTrait.ID)) {
                WaitableTrait waitableTrait = operation.expectTrait(WaitableTrait.class);
                waitableTrait
                    .getWaiters()
                    .forEach((String waiterName, Waiter waiter) -> {
                        String outputFilepath = WaiterGenerator.getOutputFileLocation(waiterName);
                        writer.write("export * from \"./$L\";", getModulePath(outputFilepath));
                    });
            }
        }

        fileManifest.writeFile(
            Paths.get(CodegenUtils.SOURCE_FOLDER, WAITERS_FOLDER, "index.ts").toString(),
            writer.toString()
        );
    }
}
