/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.integration;

import static software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention.HAS_MIDDLEWARE;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.traits.HttpChecksumRequiredTrait;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.SmithyCoreSubmodules;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.ListUtils;
import software.amazon.smithy.utils.MapUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Adds md5 checksum dependencies if needed.
 */
@SmithyInternalApi
public final class AddChecksumRequiredDependency implements TypeScriptIntegration {

    @Override
    public void addConfigInterfaceFields(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer
    ) {
        if (!hasMd5Dependency(model, settings.getService(model))) {
            return;
        }

        writer.addImport("Readable", null, "stream");
        writer.addTypeImport("StreamHasher", "__StreamHasher", TypeScriptDependency.SMITHY_TYPES);
        writer.writeDocs(
            "A function that, given a hash constructor and a stream, calculates the \n" +
                "hash of the streamed value.\n" +
                "@internal"
        );
        writer.write("streamHasher?: __StreamHasher<Readable> | __StreamHasher<Blob>;\n");

        writer.addTypeImport("HashConstructor", "__HashConstructor", TypeScriptDependency.SMITHY_TYPES);
        writer.addTypeImport("Checksum", "__Checksum", TypeScriptDependency.SMITHY_TYPES);
        writer.addTypeImport("ChecksumConstructor", "__ChecksumConstructor", TypeScriptDependency.SMITHY_TYPES);
        writer.writeDocs(
            """
            A constructor for a class implementing the {@link __Checksum} interface
            that computes MD5 hashes.
            @internal"""
        );
        writer.write("md5?: __ChecksumConstructor | __HashConstructor;\n");
    }

    @Override
    public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        LanguageTarget target
    ) {
        if (!hasMd5Dependency(model, settings.getService(model))) {
            return Collections.emptyMap();
        }

        switch (target) {
            case NODE:
                return MapUtils.of(
                    "streamHasher",
                    writer -> {
                        writer.addDependency(TypeScriptDependency.SMITHY_CORE);
                        writer.addImportSubmodule(
                            "fileStreamHasher",
                            "streamHasher",
                            TypeScriptDependency.SMITHY_CORE,
                            SmithyCoreSubmodules.CHECKSUM
                        );
                        writer.write("streamHasher");
                    },
                    "md5",
                    writer -> {
                        writer.addDependency(TypeScriptDependency.SMITHY_CORE);
                        writer.addImportSubmodule(
                            "Hash",
                            null,
                            TypeScriptDependency.SMITHY_CORE,
                            SmithyCoreSubmodules.SERDE
                        );
                        writer.write("Hash.bind(null, \"md5\")");
                    }
                );
            case BROWSER:
                return MapUtils.of(
                    "streamHasher",
                    writer -> {
                        writer.addDependency(TypeScriptDependency.SMITHY_CORE);
                        writer.addImportSubmodule(
                            "blobHasher",
                            "streamHasher",
                            TypeScriptDependency.SMITHY_CORE,
                            SmithyCoreSubmodules.CHECKSUM
                        );
                        writer.write("streamHasher");
                    },
                    "md5",
                    writer -> {
                        writer.addDependency(TypeScriptDependency.SMITHY_CORE);
                        writer.addImportSubmodule(
                            "Md5",
                            null,
                            TypeScriptDependency.SMITHY_CORE,
                            SmithyCoreSubmodules.CHECKSUM
                        );
                        writer.write("Md5");
                    }
                );
            default:
                return Collections.emptyMap();
        }
    }

    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        return ListUtils.of(
            RuntimeClientPlugin.builder()
                .withConventions(
                    TypeScriptDependency.BODY_CHECKSUM.dependency,
                    "ApplyMd5BodyChecksum",
                    HAS_MIDDLEWARE
                )
                .operationPredicate((m, s, o) -> hasChecksumRequiredTrait(m, s, o))
                .build()
        );
    }

    // return true if operation shape is decorated with `httpChecksumRequired` trait.
    private static boolean hasChecksumRequiredTrait(Model model, ServiceShape service, OperationShape operation) {
        return operation.hasTrait(HttpChecksumRequiredTrait.class);
    }

    private static boolean hasMd5Dependency(Model model, ServiceShape service) {
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> operations = topDownIndex.getContainedOperations(service);
        for (OperationShape operation : operations) {
            if (hasChecksumRequiredTrait(model, service, operation)) {
                return true;
            }
        }
        return false;
    }
}
