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

import java.util.Arrays;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.traits.DocumentationTrait;
import software.amazon.smithy.utils.IoUtils;
import software.amazon.smithy.utils.StringUtils;

public final class ReadmeGenerator {

    public static final String README_FILENAME = "README.md";
    private static final String DEFAULT_CLIENT_README_TEMPLATE = "default_readme_client.md.template";
    private static final String DEFAULT_SERVER_README_TEMPLATE = "default_readme_server.md.template";

    private ReadmeGenerator() {}

    public static void generateDefault(
        TypeScriptSettings settings,
        Model model,
        Function<String, TypeScriptWriter> writerFactory
    ) {
        String template = settings.generateClient() ? DEFAULT_CLIENT_README_TEMPLATE : DEFAULT_SERVER_README_TEMPLATE;

        TypeScriptWriter writer = writerFactory.apply(README_FILENAME);

        String resource =  IoUtils.readUtf8Resource(ReadmeGenerator.class, template);

        resource = resource.replaceAll(Pattern.quote("${packageName}"), settings.getPackageName());

        ServiceShape service = settings.getService(model);

        String serviceId = service.getId().getName();

        resource = resource.replaceAll(Pattern.quote("${serviceId}"), serviceId);

        String rawDocumentation = service.getTrait(DocumentationTrait.class)
                .map(DocumentationTrait::getValue)
                .orElse("");

        String documentation = Arrays.asList(rawDocumentation.split("\n")).stream()
                .map(StringUtils::trim)
                .collect(Collectors.joining("\n"));
        resource = resource.replaceAll(Pattern.quote("${documentation}"), Matcher.quoteReplacement(documentation));

        TopDownIndex topDownIndex = TopDownIndex.of(model);
        OperationShape firstOperation = topDownIndex.getContainedOperations(service).iterator().next();
        String operationName = firstOperation.getId().getName(service);
        resource = resource.replaceAll(Pattern.quote("${commandName}"), operationName);
        resource = resource.replaceAll(Pattern.quote("${operationName}"),
                operationName.substring(0, 1).toLowerCase() + operationName.substring(1));
        resource = resource.replaceAll(Pattern.quote("$"), Matcher.quoteReplacement("$$"));

        writer.write(resource);
    }
}
