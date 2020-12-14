/*
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.jmespath.JmespathExpression;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.waiters.Acceptor;
import software.amazon.smithy.waiters.AcceptorState;
import software.amazon.smithy.waiters.Matcher;
import software.amazon.smithy.waiters.PathMatcher;
import software.amazon.smithy.waiters.Waiter;

class WaiterGenerator implements Runnable {
    static final String WAITABLE_UTIL_PACKAGE = TypeScriptDependency.AWS_SDK_UTIL_WAITERS.packageName;

    private final String waiterName;
    private final Waiter waiter;
    private final TypeScriptWriter writer;

    private final Symbol serviceSymbol;
    private final Symbol operationSymbol;
    private final Symbol inputSymbol;

    WaiterGenerator(
            String waiterName,
            Waiter waiter,
            ServiceShape service,
            OperationShape operation,
            TypeScriptWriter writer,
            SymbolProvider symbolProvider) {
        this.waiterName = waiterName;
        this.waiter = waiter;
        this.writer = writer;

        this.operationSymbol = symbolProvider.toSymbol(operation);
        this.serviceSymbol = symbolProvider.toSymbol(service);
        this.inputSymbol = operationSymbol.expectProperty("inputType", Symbol.class);
    }

    @Override
    public void run() {
        writer.addDependency(TypeScriptDependency.AWS_SDK_UTIL_WAITERS);
        this.generateAcceptors();
        this.generateWaiter();
    }

    public static String getOutputFileLocation(String waiterName) {
        return  "waiters/waitFor" + waiterName + ".ts";
    }

    private void generateWaiter() {

        writer.addImport("createWaiter", "createWaiter", WAITABLE_UTIL_PACKAGE);
        writer.addImport("WaiterResult", "WaiterResult", WAITABLE_UTIL_PACKAGE);
        writer.addImport("WaiterState", "WaiterState", WAITABLE_UTIL_PACKAGE);
        writer.addImport("WaiterConfiguration", "WaiterConfiguration", WAITABLE_UTIL_PACKAGE);

        writer.writeDocs(waiter.getDocumentation().orElse("") + " \n"
                + " @param params : Waiter configuration options.\n"
                + " @param input : the input to " + operationSymbol.getName() + " for polling.");
        writer.openBlock("export const waitFor$L = async (params: WaiterConfiguration<$T>, input: $T): "
                + "Promise<WaiterResult> => {", "}", waiterName, serviceSymbol, inputSymbol, () -> {
            writer.write("const serviceDefaults = { minDelay: $L, maxDelay: $L };", waiter.getMinDelay(),
                            waiter.getMaxDelay());
            writer.write("return createWaiter({...serviceDefaults, ...params}, input, checkState);");
        });
    }

    private void generateAcceptors() {
        writer.openBlock("const checkState = async (client: $T, input: $T): Promise<WaiterResult> => {", "}",
                serviceSymbol, inputSymbol, () -> {
                    writer.openBlock("try {", "}", () -> {
                        writer.write("let result: any = await client.send(new $T(input))", operationSymbol);
                        writeAcceptors("result", false);
                    });
                    writer.openBlock("catch (exception) {", "}", () -> {
                        writeAcceptors("exception", true);
                    });
                    writer.write("return $L;", makeWaiterResult(AcceptorState.RETRY));
                });
    }

    private void writeAcceptors(String accessor, boolean isException) {
        waiter.getAcceptors().forEach((Acceptor acceptor) -> {
            if (acceptor.getMatcher() instanceof Matcher.SuccessMember) {
                Matcher.SuccessMember successMember = (Matcher.SuccessMember) acceptor.getMatcher();
                if (successMember.getValue() != isException) {
                    generateSuccessMatcher(successMember, acceptor.getState());
                }
            } else if (acceptor.getMatcher() instanceof Matcher.ErrorTypeMember) {
                if (isException) {
                    generateErrorMatcher(accessor, (Matcher.ErrorTypeMember) acceptor.getMatcher(),
                            acceptor.getState());
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
                throw new CodegenException("Unknown matcher member name: " + acceptor.getMatcher().getMemberName());
            }
        });
    }

    private void generateSuccessMatcher(Matcher.SuccessMember member, AcceptorState state) {
        writer.write("return $L", makeWaiterResult(state));
    }

    private void generateErrorMatcher(String accessor, Matcher.ErrorTypeMember member, AcceptorState state) {
        writer.openBlock("if ($L.name && $L.name == $S) {", "}", accessor, accessor,
                member.getValue(), () -> {
                    writer.write("return $L", makeWaiterResult(state));
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
            return  "{ state: WaiterState.SUCCESS }";
        } else if (resultantState == AcceptorState.FAILURE) {
            return  "{ state: WaiterState.FAILURE }";
        } else if (resultantState == AcceptorState.RETRY) {
            return  "{ state: WaiterState.RETRY }";
        }
        throw new CodegenException("Hit an invalid acceptor state to codegen " + resultantState.toString());
    }

}
