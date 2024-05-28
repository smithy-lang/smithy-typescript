/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols.cbor;

import java.util.Set;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.protocol.traits.Rpcv2CborTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.HttpRpcProtocolGenerator;
import software.amazon.smithy.typescript.codegen.protocols.SmithyProtocolUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generator for Smithy RPCv2 CBOR.
 */
@SmithyInternalApi
public class SmithyRpcV2Cbor extends HttpRpcProtocolGenerator {

    public SmithyRpcV2Cbor() {
        super(true);
    }

    @Override
    public void generateSharedComponents(GenerationContext context) {
        TypeScriptWriter writer = context.getWriter();

        writer.addImport("parseCborBody", "parseBody", TypeScriptDependency.SMITHY_CORE);
        writer.addImport("parseCborErrorBody", "parseErrorBody", TypeScriptDependency.SMITHY_CORE);
        writer.addImport("loadSmithyRpcV2CborErrorCode", null, TypeScriptDependency.SMITHY_CORE);

        super.generateSharedComponents(context);
    }

    @Override
    protected String getDocumentContentType() {
        return "application/cbor";
    }

    @Override
    protected void generateDocumentBodyShapeSerializers(GenerationContext generationContext, Set<Shape> shapes) {
        SmithyProtocolUtils.generateDocumentBodyShapeSerde(
            generationContext,
            shapes,
            new CborShapeSerVisitor(
                generationContext
            )
        );
    }

    @Override
    protected void generateDocumentBodyShapeDeserializers(GenerationContext generationContext, Set<Shape> shapes) {
        SmithyProtocolUtils.generateDocumentBodyShapeSerde(
            generationContext,
            shapes,
            new CborShapeDeserVisitor(
                generationContext
            )
        );
    }

    @Override
    protected String getOperationPath(GenerationContext generationContext, OperationShape operationShape) {
        // TODO(cbor) what is the prefix?
        String prefix = "";

        TypeScriptSettings settings = generationContext.getSettings();
        Model model = generationContext.getModel();
        ServiceShape service = settings.getService(model);
        SymbolProvider symbolProvider = generationContext.getSymbolProvider();

        String serviceName = symbolProvider.toSymbol(service).getName();
        String operationName = symbolProvider.toSymbol(operationShape).getName();

        return "%s/service/%s/operation/%s".formatted(prefix, serviceName, operationName);
    }

    @Override
    protected void serializeInputDocument(GenerationContext generationContext,
                                          OperationShape operationShape,
                                          StructureShape inputStructure) {
        TypeScriptWriter writer = generationContext.getWriter();

        // TODO(cbor) submodule import.
        writer.addImport("cbor", null, TypeScriptDependency.SMITHY_CORE);
        writer.write("body = cbor.serialize($L);", inputStructure.accept(
            new CborMemberSerVisitor(generationContext, "input", getDocumentTimestampFormat()))
        );
    }

    @Override
    protected void writeErrorCodeParser(GenerationContext generationContext) {
        TypeScriptWriter writer = generationContext.getWriter();

        // TODO(cbor) handle Query-Compatible
        // TODO(cbor) either by accepting a function from downstream
        // TODO(cbor) or natively here.

        // TODO(cbor) submodule import.
        writer.addImport("loadSmithyRpcV2CborErrorCode", null, TypeScriptDependency.SMITHY_CORE);
        writer.write("const errorCode = loadSmithyRpcV2CborErrorCode(output, parsedOutput.body);");
    }

    @Override
    protected void deserializeOutputDocument(GenerationContext generationContext,
                                             OperationShape operationShape,
                                             StructureShape outputStructure) {
        TypeScriptWriter writer = generationContext.getWriter();

        writer.write("contents = $L;", outputStructure.accept(
            new CborMemberDeserVisitor(
                generationContext,
                "data",
                getDocumentTimestampFormat()
            )
        ));
    }

    @Override
    public ShapeId getProtocol() {
        return Rpcv2CborTrait.ID;
    }

    @Override
    public void generateProtocolTests(GenerationContext generationContext) {

    }

    protected TimestampFormatTrait.Format getDocumentTimestampFormat() {
        return TimestampFormatTrait.Format.EPOCH_SECONDS;
    }
}
