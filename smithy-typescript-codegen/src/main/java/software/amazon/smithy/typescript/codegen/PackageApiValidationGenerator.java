/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.traits.EnumTrait;
import software.amazon.smithy.typescript.codegen.knowledge.ServiceClosure;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * This class generates a runnable pair of test files that demonstrates the exportable components of
 * the generated client are accounted for.
 */
@SmithyInternalApi
public final class PackageApiValidationGenerator {
  private final TypeScriptWriter writer;
  private final TypeScriptSettings settings;
  private final Model model;
  private final SymbolProvider symbolProvider;
  private final ServiceClosure closure;

  public PackageApiValidationGenerator(
      TypeScriptWriter writer,
      TypeScriptSettings settings,
      Model model,
      SymbolProvider symbolProvider) {
    this.writer = writer;
    this.settings = settings;
    this.model = model;
    this.symbolProvider = symbolProvider;
    closure = ServiceClosure.of(model, settings.getService(model));
  }

  /** Code written by this method is types-only TypeScript. */
  public void writeTypeIndexTest() {
    writer.openBlock(
        """
        export type {\
        """,
        """
        } from "../dist-types/index.d";\
        """,
        () -> {
          // exportable types include:

          // the barebones client
          String aggregateClientName = CodegenUtils.getServiceName(settings, model, symbolProvider);
          writer.write("$L", aggregateClientName + "Client,");

          // the aggregate client
          writer.write(aggregateClientName + ",");

          // all commands
          Set<OperationShape> containedOperations =
              TopDownIndex.of(model).getContainedOperations(settings.getService());
          for (OperationShape operation : containedOperations) {
            String commandName = symbolProvider.toSymbol(operation).getName();
            writer.write("$L,", commandName);
            writer.write("$LInput,", commandName);
            writer.write("$LOutput,", commandName);
          }

          // enums
          TreeSet<Shape> enumShapes = closure.getEnums();
          for (Shape enumShape : enumShapes) {
            writer.write("$L,", symbolProvider.toSymbol(enumShape).getName());
          }

          // structure & union types & modeled errors
          TreeSet<Shape> structuralShapes = closure.getStructuralNonErrorShapes();
          for (Shape structuralShape : structuralShapes) {
            writer.write("$L,", symbolProvider.toSymbol(structuralShape).getName());
          }

          TreeSet<Shape> errorShapes = closure.getErrorShapes();
          for (Shape errorShape : errorShapes) {
            writer.write("$L,", symbolProvider.toSymbol(errorShape).getName());
          }

          // synthetic base exception
          String baseExceptionName =
              CodegenUtils.getSyntheticBaseExceptionName(aggregateClientName, model);
          writer.write("$L,", baseExceptionName);

          // waiters
          closure
              .getWaiterNames()
              .forEach(
                  waiter -> {
                    writer.write("$L,", waiter);
                  });
          // paginators
          closure
              .getPaginatorNames()
              .forEach(
                  paginator -> {
                    writer.write("$L,", paginator);
                  });
        });
  }

  /** Code written by this method is pure JavaScript (CJS). */
  public void writeRuntimeIndexTest() {
    writer.write(
        """
        import assert from "node:assert";\
        """);
    // runtime components include:

    Path cjsIndex = Paths.get("./dist-cjs/index.js");

    // the barebones client
    String aggregateClientName = CodegenUtils.getServiceName(settings, model, symbolProvider);
    writer.addRelativeImport(aggregateClientName + "Client", null, cjsIndex);
    writer.addRelativeImport(aggregateClientName, null, cjsIndex);

    // the aggregate client
    writer.write("// clients");
    writer.write(
        """
        assert(typeof $L === "function");\
        """,
        aggregateClientName + "Client");
    writer.write(
        """
        assert(typeof $L === "function");\
        """,
        aggregateClientName);

    // all commands
    writer.write("// commands");
    Set<OperationShape> containedOperations =
        TopDownIndex.of(model).getContainedOperations(settings.getService());
    for (OperationShape operation : containedOperations) {
      Symbol operationSymbol = symbolProvider.toSymbol(operation);
      writer.addRelativeImport(operationSymbol.getName(), null, cjsIndex);
      writer.write(
          """
          assert(typeof $L === "function");\
          """,
          operationSymbol.getName());
    }

    // enums

    // string shapes with enum trait do not generate anything if
    // any enum value does not have a name.
    TreeSet<Shape> enumShapes =
        closure.getEnums().stream()
            .filter(shape -> shape.getTrait(EnumTrait.class).map(EnumTrait::hasNames).orElse(true))
            .collect(TreeSet::new, Set::add, Set::addAll);

    if (!enumShapes.isEmpty()) {
      writer.write("// enums");
    }
    for (Shape enumShape : enumShapes) {
      Symbol enumSymbol = symbolProvider.toSymbol(enumShape);
      writer.addRelativeImport(enumSymbol.getName(), null, cjsIndex);
      writer.write(
          """
          assert(typeof $L === "object");\
          """,
          enumSymbol.getName());
    }

    String baseExceptionName =
        CodegenUtils.getSyntheticBaseExceptionName(aggregateClientName, model);

    // modeled errors and synthetic base error
    writer.write("// errors");
    TreeSet<Shape> errors = closure.getErrorShapes();
    for (Shape error : errors) {
      Symbol errorSymbol = symbolProvider.toSymbol(error);
      writer.addRelativeImport(errorSymbol.getName(), null, cjsIndex);
      writer.write("assert($L.prototype instanceof $L);", errorSymbol.getName(), baseExceptionName);
    }
    writer.addRelativeImport(baseExceptionName, null, cjsIndex);
    writer.write("assert($L.prototype instanceof Error);", baseExceptionName);

    // waiters & paginators
    TreeSet<String> waiterNames = closure.getWaiterNames();
    if (!waiterNames.isEmpty()) {
      writer.write("// waiters");
    }
    waiterNames.forEach(
        waiter -> {
          writer.addRelativeImport(waiter, null, cjsIndex);
          writer.write(
              """
              assert(typeof $L === "function");\
              """,
              waiter);
        });
    TreeSet<String> paginatorNames = closure.getPaginatorNames();
    if (!paginatorNames.isEmpty()) {
      writer.write("// paginators");
    }
    paginatorNames.forEach(
        paginator -> {
          writer.addRelativeImport(paginator, null, cjsIndex);
          writer.write(
              """
              assert(typeof $L === "function");\
              """,
              paginator);
        });

    writer.write("console.log(`$L index test passed.`);", aggregateClientName);
  }
}
