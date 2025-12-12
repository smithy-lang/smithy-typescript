/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.documentation;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.node.ObjectNode;

class DocumentationExampleGeneratorTest {

    ObjectNode input = ObjectNode.builder()
        .withMember("Key", "example-key")
        .withMember("Bucket", "example-key")
        .build();

    ObjectNode output = ObjectNode.builder()
        .withMember("Config", ObjectNode.builder().withMember("Temperature", 30).build())
        .build();

    @Test
    void inputToJavaScriptObject() {
        String example = DocumentationExampleGenerator.inputToJavaScriptObject(input);
        assertEquals(
            """
            {
              Bucket: "example-key",
              Key: "example-key"
            }""",
            example
        );
    }

    @Test
    void outputToJavaScriptObject() {
        String example = DocumentationExampleGenerator.inputToJavaScriptObject(output);
        assertEquals(
            """
            {
              Config: {
                Temperature: 30
              }
            }""",
            example
        );
    }
}
