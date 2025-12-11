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

package software.amazon.smithy.typescript.codegen.integration;

import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.traits.DocumentationTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptCodegenContext;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.utils.IoUtils;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.StringUtils;

@SmithyInternalApi
public final class DefaultReadmeGenerator implements TypeScriptIntegration {

  public static final String README_FILENAME = "README.md";
  public static final String DEFAULT_CLIENT_README_TEMPLATE = "default_readme_client.md.template";
  public static final String DEFAULT_SERVER_README_TEMPLATE = "default_readme_server.md.template";

  @Override
  public void customize(TypeScriptCodegenContext codegenContext) {
    TypeScriptSettings settings = codegenContext.settings();

    if (!settings.createDefaultReadme()) {
      return;
    }

    String file =
        settings.generateClient() ? DEFAULT_CLIENT_README_TEMPLATE : DEFAULT_SERVER_README_TEMPLATE;

    Model model = codegenContext.model();

    codegenContext
        .writerDelegator()
        .useFileWriter(
            README_FILENAME,
            "",
            writer -> {
              ServiceShape service = settings.getService(model);
              String resource = IoUtils.readUtf8Resource(getClass(), file);
              resource =
                  resource.replaceAll(Pattern.quote("${packageName}"), settings.getPackageName());

              String clientName = StringUtils.capitalize(service.getId().getName(service));

              resource = resource.replaceAll(Pattern.quote("${serviceId}"), clientName);

              String rawDocumentation =
                  service
                      .getTrait(DocumentationTrait.class)
                      .map(DocumentationTrait::getValue)
                      .orElse("");
              String documentation =
                  Arrays.asList(rawDocumentation.split("\n")).stream()
                      .map(StringUtils::trim)
                      .collect(Collectors.joining("\n"));
              resource =
                  resource.replaceAll(
                      Pattern.quote("${documentation}"), Matcher.quoteReplacement(documentation));

              TopDownIndex topDownIndex = TopDownIndex.of(model);
              OperationShape firstOperation =
                  topDownIndex.getContainedOperations(service).iterator().next();
              String operationName = firstOperation.getId().getName(service);
              resource = resource.replaceAll(Pattern.quote("${commandName}"), operationName);

              // The $ character is escaped using $$
              writer.write(resource.replaceAll(Pattern.quote("$"), Matcher.quoteReplacement("$$")));
            });
  }
}
