/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.util.Iterator;
import java.util.Set;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
final class ServerGenerator {

    private ServerGenerator() {}

    static void generateOperationsType(
        SymbolProvider symbolProvider,
        Shape serviceShape,
        Set<OperationShape> operations,
        TypeScriptWriter writer
    ) {
        Symbol serviceSymbol = symbolProvider.toSymbol(serviceShape);
        writer.writeInline("export type $L = ", serviceSymbol.expectProperty("operations", Symbol.class).getName());
        for (Iterator<OperationShape> iter = operations.iterator(); iter.hasNext();) {
            writer.writeInline("$S", symbolProvider.toSymbol(iter.next()).getName());
            if (iter.hasNext()) {
                writer.writeInline(" | ");
            }
        }
        writer.write(";");
    }

    static void generateServiceHandler(
        SymbolProvider symbolProvider,
        Shape serviceShape,
        Set<OperationShape> operations,
        TypeScriptWriter writer
    ) {
        addCommonHandlerImports(writer);

        Symbol serviceSymbol = symbolProvider.toSymbol(serviceShape);
        Symbol handlerSymbol = serviceSymbol.expectProperty("handler", Symbol.class);
        Symbol operationsType = serviceSymbol.expectProperty("operations", Symbol.class);

        writeSerdeContextBase(writer);

        writer.openBlock(
            "const $LValidators: { [K in $T]: (input: any) => __ValidationFailure[] } = {",
            "};",
            handlerSymbol.getName(),
            operationsType,
            () -> {
                for (OperationShape operation : operations) {
                    Symbol operationSymbol = symbolProvider.toSymbol(operation);
                    Symbol inputSymbol = operationSymbol.expectProperty("inputType", Symbol.class);
                    writer.write("$S: $T.validate,", operationSymbol.getName(), inputSymbol);
                }
            }
        );

        String classDeclaration = "export class $L<Context> implements __ServiceHandler<Context> {";
        writer.openBlock(classDeclaration, "}", handlerSymbol.getName(), () -> {
            writer.write("private readonly mux: __Mux<$S, $T>;", serviceShape.getId().getName(), operationsType);
            writer.write(
                "private readonly service: $T<Context>;",
                serviceSymbol
            );
            writer.write(
                "private readonly serializerFactory: <T extends $T>(op: T) => "
                    + "__OperationSerializer<$T<Context>, T, __ServiceException>;",
                operationsType,
                serviceSymbol
            );
            writer.write(
                "private readonly serializeFrameworkException: (e: __SmithyFrameworkException, "
                    + "ctx: __ServerSerdeContext) => Promise<__HttpResponse>;"
            );
            writer.write("private readonly validationCustomizer: __ValidationCustomizer<$T>;", operationsType);
            writeInterceptorState(writer);

            writer.writeDocs(() -> {
                writer.write("Construct a $T handler.", serviceSymbol);
                writer.write(
                    "@param service The {@link $1T} implementation that supplies the business logic for $1T",
                    serviceSymbol
                );
                writer.writeInline("@param mux The {@link __Mux} that determines which service and operation are ");
                writer.write("being invoked by a given {@link __HttpRequest}");
                writer.writeInline("@param serializerFactory A factory for an {@link __OperationSerializer} for each ");
                writer.write("operation in $T that ", serviceSymbol);
                writer
                    .writeInline("                         ")
                    .write("handles deserialization of requests and serialization of responses");
                writer.write(
                    "@param serializeFrameworkException A function that can serialize " +
                        "{@link __SmithyFrameworkException}s"
                );
                writer.write(
                    "@param validationCustomizer A {@link __ValidationCustomizer} for turning validation " +
                        "failures into {@link __SmithyFrameworkException}s"
                );
            });
            writer.openBlock("constructor(", ") {", () -> {
                writer.write("service: $T<Context>,", serviceSymbol);
                writer.write("mux: __Mux<$S, $T>,", serviceShape.getId().getName(), operationsType);
                writer.write(
                    "serializerFactory:<T extends $T>(op: T) => " +
                        "__OperationSerializer<$T<Context>, T, __ServiceException>,",
                    operationsType,
                    serviceSymbol
                );
                writer.write(
                    "serializeFrameworkException: (e: __SmithyFrameworkException, ctx: __ServerSerdeContext) " +
                        "=> Promise<__HttpResponse>,"
                );
                writer.write("validationCustomizer: __ValidationCustomizer<$T>", operationsType);
            });
            writer.indent();
            writer.write("this.service = service;");
            writer.write("this.mux = mux;");
            writer.write("this.serializerFactory = serializerFactory;");
            writer.write("this.serializeFrameworkException = serializeFrameworkException;");
            writer.write("this.validationCustomizer = validationCustomizer;");
            writer.closeBlock("}");

            writeInterceptorRegistration(writer);

            writeHandleMethod(
                writer,
                () -> {
                    writer.write("route: (request) => this.mux.match(request)?.operation,");
                    writer.openBlock(
                        "deserialize: (operation, request) => timed(\"DeserializationTime\", async () => {",
                        "}),",
                        () -> {
                            writer.openBlock("try {", "} catch (error: unknown) {", () -> {
                                writer.write(
                                    "return await this.serializerFactory(operation as $L).deserialize(request, "
                                        + "{ endpoint: () => Promise.resolve(request), ...serdeContextBase });",
                                    operationsType.getName()
                                );
                            });
                            writer.indent();
                            writer.openBlock("if (__isFrameworkException(error)) {", "}", () -> {
                                writer.write("throw error;");
                            });
                            writer.write("throw new __SerializationException();");
                            writer.closeBlock("}");
                        }
                    );
                    writer.openBlock(
                        "validate: (operation, input) => timedSync(\"ValidationTime\", () => {",
                        "}),",
                        () -> {
                            writer.write(
                                "const validationFailures = $LValidators[operation as $L](input);",
                                handlerSymbol.getName(),
                                operationsType.getName()
                            );
                            writer.openBlock("if (validationFailures && validationFailures.length > 0) {", "}", () -> {
                                writer.write(
                                    "const validationException = this.validationCustomizer("
                                        + "{ operation: operation as $L }, validationFailures);",
                                    operationsType.getName()
                                );
                                writer.openBlock("if (validationException) {", "}", () -> {
                                    writer.write("throw validationException;");
                                });
                            });
                        }
                    );
                    writer.write(
                        "invoke: (operation, input, context) => "
                            + "timed(\"ActivityTime\", () => (this.service[operation as $L] as any)(input, context)),",
                        operationsType.getName()
                    );
                    writer.write(
                        "serialize: (operation, output) => "
                            + "timed(\"SerializationTime\", () => "
                            + "this.serializerFactory(operation as $L).serialize(output as any, serdeContextBase)),",
                        operationsType.getName()
                    );
                    writer.openBlock("serializeError: (operation, error) => {", "},", () -> {
                        writer.openBlock("if (operation === undefined) {", "}", () -> {
                            writer.write("return undefined;");
                        });
                        writer.write(
                            "const serializer = this.serializerFactory(operation as $L);",
                            operationsType.getName()
                        );
                        writer.write(
                            "return serializer.isOperationError(error) ? "
                                + "serializer.serializeError(error, serdeContextBase) : undefined;"
                        );
                    });
                    writer.write(
                        "serializeFrameworkException: (e) => "
                            + "this.serializeFrameworkException(e, serdeContextBase),"
                    );
                }
            );
        });
    }

    static void generateOperationHandler(
        SymbolProvider symbolProvider,
        Shape serviceShape,
        OperationShape operation,
        TypeScriptWriter writer
    ) {
        addCommonHandlerImports(writer);
        writer.addImport("Operation", "__Operation", TypeScriptDependency.SERVER_COMMON);

        writeSerdeContextBase(writer);

        Symbol serviceSymbol = symbolProvider.toSymbol(serviceShape);
        Symbol operationSymbol = symbolProvider.toSymbol(operation);
        String operationName = operationSymbol.getName();

        Symbol inputSymbol = operationSymbol.expectProperty("inputType", Symbol.class);
        Symbol outputSymbol = operationSymbol.expectProperty("outputType", Symbol.class);
        Symbol handlerSymbol = operationSymbol.expectProperty("handler", Symbol.class);
        Symbol errorsSymbol = operationSymbol.expectProperty("errorsType", Symbol.class);

        String declaration = "export class $L<Context> implements __ServiceHandler<Context> {";
        writer.openBlock(declaration, "}", handlerSymbol.getName(), () -> {
            writer.write("private readonly mux: __Mux<$S, $S>;", serviceShape.getId().getName(), operationName);
            writer.write("private readonly operation: __Operation<$T, $T, Context>;", inputSymbol, outputSymbol);
            writer.write(
                "private readonly serializer: __OperationSerializer<$T<Context>, $S, $T>;",
                serviceSymbol,
                operationName,
                errorsSymbol
            );
            writer.write(
                "private readonly serializeFrameworkException: (e: __SmithyFrameworkException, "
                    + "ctx: __ServerSerdeContext) => Promise<__HttpResponse>;"
            );
            writer.write("private readonly validationCustomizer: __ValidationCustomizer<$S>;", operationName);
            writeInterceptorState(writer);

            writer.writeDocs(() -> {
                writer.write("Construct a $T handler.", operationSymbol);
                writer.write(
                    "@param operation The {@link __Operation} implementation that supplies the business " +
                        "logic for $1T",
                    operationSymbol
                );
                writer.writeInline("@param mux The {@link __Mux} that verifies which service and operation are being ");
                writer.write("invoked by a given {@link __HttpRequest}");
                writer.write("@param serializer An {@link __OperationSerializer} for $T that ", operationSymbol);
                writer
                    .writeInline("                  ")
                    .write("handles deserialization of requests and serialization of responses");
                writer.write(
                    "@param serializeFrameworkException A function that can serialize " +
                        "{@link __SmithyFrameworkException}s"
                );
                writer.write(
                    "@param validationCustomizer A {@link __ValidationCustomizer} for turning validation " +
                        "failures into {@link __SmithyFrameworkException}s"
                );
            });
            writer.openBlock("constructor(", ") {", () -> {
                writer.write("operation: __Operation<$T, $T, Context>,", inputSymbol, outputSymbol);
                writer.write("mux: __Mux<$S, $S>,", serviceShape.getId().getName(), operationName);
                writer.write(
                    "serializer: __OperationSerializer<$T<Context>, $S, $T>,",
                    serviceSymbol,
                    operationName,
                    errorsSymbol
                );
                writer.write(
                    "serializeFrameworkException: (e: __SmithyFrameworkException, ctx: __ServerSerdeContext) " +
                        "=> Promise<__HttpResponse>,"
                );
                writer.write("validationCustomizer: __ValidationCustomizer<$S>", operationName);
            });
            writer.indent();
            writer.write("this.operation = operation;");
            writer.write("this.mux = mux;");
            writer.write("this.serializer = serializer;");
            writer.write("this.serializeFrameworkException = serializeFrameworkException;");
            writer.write("this.validationCustomizer = validationCustomizer;");
            writer.closeBlock("}");

            writeInterceptorRegistration(writer);

            writeHandleMethod(
                writer,
                () -> {
                    writer.write(
                        "route: (request) => this.mux.match(request) !== undefined ? $S : undefined,",
                        operationName
                    );
                    writer.openBlock(
                        "deserialize: (_op, request) => timed(\"DeserializationTime\", async () => {",
                        "}),",
                        () -> {
                            writer.openBlock("try {", "} catch (error: unknown) {", () -> {
                                writer.write(
                                    "return await this.serializer.deserialize(request, "
                                        + "{ endpoint: () => Promise.resolve(request), ...serdeContextBase });"
                                );
                            });
                            writer.indent();
                            writer.openBlock("if (__isFrameworkException(error)) {", "}", () -> {
                                writer.write("throw error;");
                            });
                            writer.write("throw new __SerializationException();");
                            writer.closeBlock("}");
                        }
                    );
                    writer.openBlock("validate: (_op, input) => timedSync(\"ValidationTime\", () => {", "}),", () -> {
                        writer.write(
                            "const validationFailures = ($T.validate as (input: any) => "
                                + "__ValidationFailure[])(input);",
                            inputSymbol
                        );
                        writer.openBlock("if (validationFailures && validationFailures.length > 0) {", "}", () -> {
                            writer.write(
                                "const validationException = this.validationCustomizer({ operation: $S }, "
                                    + "validationFailures);",
                                operationName
                            );
                            writer.openBlock("if (validationException) {", "}", () -> {
                                writer.write("throw validationException;");
                            });
                        });
                    });
                    writer.write(
                        "invoke: (_op, input, context) => "
                            + "timed(\"ActivityTime\", () => this.operation(input as $T, context)),",
                        inputSymbol
                    );
                    writer.write(
                        "serialize: (_op, output) => "
                            + "timed(\"SerializationTime\", () => "
                            + "this.serializer.serialize(output as $T, serdeContextBase)),",
                        outputSymbol
                    );
                    writer.write(
                        "serializeError: (_op, error) => "
                            + "this.serializer.isOperationError(error) ? "
                            + "this.serializer.serializeError(error, serdeContextBase) : undefined,"
                    );
                    writer.write(
                        "serializeFrameworkException: (e) => "
                            + "this.serializeFrameworkException(e, serdeContextBase),"
                    );
                }
            );
        });
    }

    /** Per-handler interceptor, auth-scheme, and metrics state. */
    private static void writeInterceptorState(TypeScriptWriter writer) {
        writer.write("private readonly interceptors: __ServerInterceptor<Context>[] = [];");
        writer.write("private readonly authSchemes: __AuthScheme<Context>[] = [];");
        writer.write("private metricsRecorderFactory?: __MetricsRecorderFactory<any>;");
    }

    /**
     * Emit the chainable registration methods (withAuth / addInterceptor / addInterceptors). These
     * mirror the opt-in registration surface so interceptors and auth are additive.
     */
    private static void writeInterceptorRegistration(TypeScriptWriter writer) {
        writer.openBlock(
            "withMetrics<Native>(metricsRecorderFactory: __MetricsRecorderFactory<Native>): this {",
            "}",
            () -> {
                writer.write("this.metricsRecorderFactory = metricsRecorderFactory;");
                writer.write("return this;");
            }
        );
        writer.openBlock("withAuth(...schemes: __AuthScheme<Context>[]): this {", "}", () -> {
            writer.write("this.authSchemes.push(...schemes);");
            writer.write("return this;");
        });
        writer.openBlock("addInterceptor(interceptor: __ServerInterceptor<Context>): this {", "}", () -> {
            writer.write("this.interceptors.unshift(interceptor);");
            writer.write("return this;");
        });
        writer.openBlock("addInterceptors(...interceptors: __ServerInterceptor<Context>[]): this {", "}", () -> {
            writer.write("this.interceptors.unshift(...[...interceptors].reverse());");
            writer.write("return this;");
        });
    }

    /**
     * Emit the full interceptor pipeline (the handle() method plus its private helpers) inline into
     * the handler. The framework steps (route / deserialize / validate / invoke / serialize /
     * serializeError / serializeFrameworkException) are supplied by the caller as a TypeScript
     * object literal body via {@code stepsBody}; everything else (hook firing, the authenticate
     * loop, error conversion, and balanced teardown) is identical across handlers.
     *
     * @param stepsBody emits the per-handler {@code FrameworkSteps} object-literal members
     */
    private static void writeHandleMethod(
        TypeScriptWriter writer,
        Runnable stepsBody
    ) {
        writer.openBlock(
            "async handle(request: __HttpRequest, context: Context): Promise<__HttpResponse> {",
            "}",
            () -> {
                writer.write(
                    "const recorder: __MetricsRecorder<any> | undefined = this.metricsRecorderFactory?.create();"
                );
                writer.write(
                    "const safeRecord = (fn: (recorder: __MetricsRecorder<any>) => void): void => "
                        + "__recordSafely(recorder, fn);"
                );
                writer.write(
                    "const timed = <T>(name: string, fn: () => Promise<T>): Promise<T> => "
                        + "__recordTimed(recorder, name, fn);"
                );
                writer.write(
                    "const timedSync = <T>(name: string, fn: () => T): T => "
                        + "__recordTimedSync(recorder, name, fn);"
                );
                writer.write("");

                writer.openBlock("const steps: __FrameworkSteps<Context> = {", "};", stepsBody);
                writer.write("");
                writer.write("let metricsErrorClass: \"Error\" | \"Fault\" | \"Failure\" | undefined;");
                writer.openBlock(
                    "const convertError = (op: string | undefined, caught: unknown): Promise<__HttpResponse> => {",
                    "};",
                    () -> {
                        writer.write("const modeled = steps.serializeError(op, caught);");
                        writer.openBlock("if (modeled) {", "}", () -> {
                            writer.write("metricsErrorClass = \"Error\";");
                            writer.write("return modeled;");
                        });
                        writer.openBlock("if (__isFrameworkException(caught)) {", "}", () -> {
                            writer.write("metricsErrorClass = \"Fault\";");
                            writer.write("return steps.serializeFrameworkException(caught);");
                        });
                        writer.write("metricsErrorClass = \"Failure\";");
                        writer.write("return steps.serializeFrameworkException(new __InternalFailureException());");
                    }
                );
                writer.write("");
                writer.write("const base = { request, context };");
                writer.write("let operation: string | undefined;");
                writer.write("let input: unknown;");
                writer.write("let output: unknown;");
                writer.write("let response: __HttpResponse | undefined;");
                writer.write("let caller: __Caller | undefined;");
                writer.write("let error: unknown;");
                writer.write("");
                writer.write("const entered = new Set<__ServerInterceptor<Context>>();");
                writer.write("");

                writer.write("safeRecord((r) => r.begin());");
                writer.write(
                    "// TODO: expose metricsRecorder via a typed server context instead of casting."
                );
                writer.write(
                    "(context as { metricsRecorder?: __MetricsRecorder<any> }).metricsRecorder = recorder;"
                );
                writer.write("const __metricsStart = performance.now();");
                writer.write("");

                writer.openBlock("const runPipeline = async (): Promise<__HttpResponse> => {", "};", () -> {
                    writer.openBlock("try {", "} catch (caught: unknown) {", () -> {
                        writer.openBlock("for (const interceptor of this.interceptors) {", "}", () -> {
                            writer.openBlock("if (interceptor.readBeforeExecution) {", "}", () -> {
                                writer.write("interceptor.readBeforeExecution(base);");
                            });
                            writer.write("entered.add(interceptor);");
                        });
                        writer.write("");
                        writer.write("let authScheme: string | undefined;");
                        writer.openBlock("if (this.authSchemes.length > 0) {", "}", () -> {
                            writer.openBlock("for (const scheme of this.authSchemes) {", "}", () -> {
                                writer.write("const result = await scheme.authenticate(request, context);");
                                writer.openBlock("if (result) {", "}", () -> {
                                    writer.write("caller = result;");
                                    writer.write("authScheme = scheme.name;");
                                    writer.write("break;");
                                });
                            });
                            writer.openBlock("if (!caller) {", "}", () -> {
                                writer.write("throw new __UnauthenticatedException();");
                            });
                            writer.write(
                                "this.fireRead(\"readAfterAuthentication\", () => "
                                    + "({ ...base, authScheme: authScheme!, caller: caller! }));"
                            );
                        });
                        writer.write("");
                        writer.write(
                            "const req = this.fireModify<__HttpRequest, typeof base>("
                                + "\"modifyBeforeDeserialization\", request, (r) => ({ ...base, request: r }));"
                        );
                        writer.write("");
                        writer.write("operation = steps.route(req);");
                        writer.openBlock("if (!operation) {", "}", () -> {
                            writer.write("throw new __UnknownOperationException();");
                        });
                        writer.write("");
                        writer.write("input = await steps.deserialize(operation, req);");
                        writer.write("const inputHook = () => ({ ...base, operation: operation!, input });");
                        writer.write("this.fireRead(\"readAfterDeserialization\", inputHook);");
                        writer.write(
                            "input = this.fireModify(\"modifyBeforeValidation\", input, (v) => "
                                + "({ ...base, operation: operation!, input: v }));"
                        );
                        writer.write("steps.validate(operation, input);");
                        writer.write("this.fireRead(\"readAfterValidation\", inputHook);");
                        writer.write("this.fireRead(\"readBeforeInvocation\", inputHook);");
                        writer.write("output = await steps.invoke(operation, input, context);");
                        writer.write(
                            "this.fireRead(\"readAfterInvocation\", () => "
                                + "({ ...base, operation: operation!, input, output }));"
                        );
                        writer.write(
                            "output = this.fireModify(\"modifyBeforeSerialization\", output, (v) => "
                                + "({ ...base, operation: operation!, input, output: v }));"
                        );
                        writer.write("response = await steps.serialize(operation, output);");
                        writer.write(
                            "this.fireRead(\"readAfterSerialization\", () => "
                                + "({ ...base, operation: operation!, input, output, response: response! }));"
                        );
                    });
                    writer.indent();
                    writer.write("error = caught;");
                    writer.write("response = await convertError(operation, caught);");
                    writer.closeBlock("}");

                    writer.write("");
                    writer.openBlock("try {", "} catch (caught: unknown) {", () -> {
                        writer.write(
                            "response = this.fireModify(\"modifyBeforeCompletion\", response!, (v) => "
                                + "({ ...base, operation: operation!, input, output, response: v }));"
                        );
                    });
                    writer.indent();
                    writer.write("error = caught;");
                    writer.write("response = await convertError(operation, caught);");
                    writer.closeBlock("}");

                    writer.write("");
                    writer.write(
                        "const execHook: __ExecutionHook<Context> = "
                            + "{ request, context, operation, input, output, response, error };"
                    );
                    writer.openBlock("for (const interceptor of this.interceptors) {", "}", () -> {
                        writer.openBlock(
                            "if (entered.has(interceptor) && interceptor.readAfterExecution) {",
                            "}",
                            () -> {
                                writer.openBlock("try {", "} catch (e) {", () -> {
                                    writer.write("interceptor.readAfterExecution(execHook);");
                                });
                                writer.indent();
                                writer.write(
                                    "// readAfterExecution is best-effort and must not mask the response; "
                                        + "ignore hook failures."
                                );
                                writer.closeBlock("}");
                            }
                        );
                    });
                    writer.write("");
                    writer.write("return response!;");
                });

                writer.write("");
                writer.openBlock("try {", "} finally {", () -> {
                    writer.write("return await runPipeline();");
                });
                writer.indent();
                writer.openBlock("if (operation) {", "}", () -> {
                    writer.write("safeRecord((r) => r.setProperty(\"Operation\", operation!));");
                });
                writer.write(
                    "safeRecord((r) => r.recordRequestOutcome("
                        + "error === undefined ? \"Success\" : \"Fault\", performance.now() - __metricsStart));"
                );
                writer.write("safeRecord((r) => r.addCount(\"Error\", metricsErrorClass === \"Error\" ? 1 : 0));");
                writer.write(
                    "safeRecord((r) => r.addCount(\"Fault\", "
                        + "metricsErrorClass === \"Fault\" || metricsErrorClass === \"Failure\" ? 1 : 0));"
                );
                writer.write(
                    "safeRecord((r) => r.addCount(\"Failure\", metricsErrorClass === \"Failure\" ? 1 : 0));"
                );
                writer.write("safeRecord((r) => r.end());");
                writer.closeBlock("}");
            }
        );

        writer.openBlock(
            "private fireRead<H>(method: keyof __ServerInterceptor<Context>, buildHook: () => H): void {",
            "}",
            () -> {
                writer.openBlock("for (const interceptor of this.interceptors) {", "}", () -> {
                    writer.write("const fn = interceptor[method] as ((hook: H) => void) | undefined;");
                    writer.openBlock("if (fn) {", "}", () -> writer.write("fn.call(interceptor, buildHook());"));
                });
            }
        );

        writer.openBlock(
            "private fireModify<V, H>(method: keyof __ServerInterceptor<Context>, initial: V, "
                + "buildHook: (current: V) => H): V {",
            "}",
            () -> {
                writer.write("let current = initial;");
                writer.openBlock("for (const interceptor of this.interceptors) {", "}", () -> {
                    writer.write("const fn = interceptor[method] as ((hook: H) => V) | undefined;");
                    writer.openBlock(
                        "if (fn) {",
                        "}",
                        () -> writer.write("current = fn.call(interceptor, buildHook(current));")
                    );
                });
                writer.write("return current;");
            }
        );
    }

    private static void addCommonHandlerImports(TypeScriptWriter writer) {
        writer.addImport("ServiceHandler", "__ServiceHandler", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("FrameworkSteps", "__FrameworkSteps", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("ServerInterceptor", "__ServerInterceptor", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("AuthScheme", "__AuthScheme", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("Caller", "__Caller", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("ExecutionHook", "__ExecutionHook", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("Mux", "__Mux", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("OperationSerializer", "__OperationSerializer", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("InternalFailureException", "__InternalFailureException", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("SerializationException", "__SerializationException", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("UnauthenticatedException", "__UnauthenticatedException", TypeScriptDependency.SERVER_COMMON);
        writer.addImport(
            "UnknownOperationException",
            "__UnknownOperationException",
            TypeScriptDependency.SERVER_COMMON
        );
        writer.addImport("SmithyFrameworkException", "__SmithyFrameworkException", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("ValidationFailure", "__ValidationFailure", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("isFrameworkException", "__isFrameworkException", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("recordSafely", "__recordSafely", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("recordTimed", "__recordTimed", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("recordTimedSync", "__recordTimedSync", TypeScriptDependency.SERVER_COMMON);
        writer.addImportSubmodule(
            "HttpRequest",
            "__HttpRequest",
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.PROTOCOLS
        );
        writer.addImportSubmodule(
            "HttpResponse",
            "__HttpResponse",
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.PROTOCOLS
        );
        writer.addImport("ServiceException", "__ServiceException", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("ValidationCustomizer", "__ValidationCustomizer", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("MetricsRecorder", "__MetricsRecorder", TypeScriptDependency.SMITHY_TYPES);
        writer.addImport("MetricsRecorderFactory", "__MetricsRecorderFactory", TypeScriptDependency.SMITHY_TYPES);
    }

    private static void writeSerdeContextBase(TypeScriptWriter writer) {
        writer.addImport("ServerSerdeContext", "__ServerSerdeContext", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("NodeHttpHandler", null, TypeScriptDependency.AWS_SDK_NODE_HTTP_HANDLER);
        writer.addImport("streamCollector", null, TypeScriptDependency.AWS_SDK_NODE_HTTP_HANDLER);
        writer.addImportSubmodule("fromBase64", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.SERDE);
        writer.addImportSubmodule("toBase64", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.SERDE);
        writer.addImportSubmodule("fromUtf8", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.SERDE);
        writer.addImportSubmodule("toUtf8", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.SERDE);

        writer.openBlock("const serdeContextBase = {", "};", () -> {
            writer.write("base64Encoder: toBase64,");
            writer.write("base64Decoder: fromBase64,");
            writer.write("utf8Encoder: toUtf8,");
            writer.write("utf8Decoder: fromUtf8,");
            writer.write("streamCollector: streamCollector,");
            writer.write("requestHandler: new NodeHttpHandler(),");
            writer.write("disableHostPrefix: true");
        });
    }

    static void generateServerInterfaces(
        SymbolProvider symbolProvider,
        ServiceShape service,
        Set<OperationShape> operations,
        TypeScriptWriter writer
    ) {
        writer.addImport("Operation", "__Operation", TypeScriptDependency.SERVER_COMMON);

        String serviceInterfaceName = symbolProvider.toSymbol(service).getName();

        writer.openCollapsibleBlock(
            "export interface $L<Context> {",
            "}",
            !operations.isEmpty(),
            serviceInterfaceName,
            () -> {
                for (OperationShape operation : operations) {
                    Symbol symbol = symbolProvider.toSymbol(operation);
                    writer.write("$L: $T<Context>", symbol.getName(), symbol);
                }
            }
        );
    }
}
