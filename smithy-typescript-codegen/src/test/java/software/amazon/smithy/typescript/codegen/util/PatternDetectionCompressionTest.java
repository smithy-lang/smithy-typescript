/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.node.Node;

class PatternDetectionCompressionTest {

    private static String compress(String json) {
        return new PatternDetectionCompression(Node.parse(json).expectObjectNode()).compress();
    }

    @Test
    void compressesEmptyObject() {
        assertEquals(
            """
            const _data={
            };
            """,
            compress("{}")
        );
    }

    @Test
    void compressesFlatObjectWithoutDuplicates() {
        assertEquals(
            """
            const _data={
              a: "hello",
              b: 42,
              c: true
            };
            """,
            compress("""
                     {"a":"hello","b":42,"c":true}""")
        );
    }

    @Test
    void extractsRepeatedSubtrees() {
        assertEquals(
            """
            const a={"type":"string","req":true};
            const _data={
              f1: a,
              f2: a,
              f3: a
            };
            """,
            compress("""
                     {
                       "f1":{"type":"string","req":true},
                       "f2":{"type":"string","req":true},
                       "f3":{"type":"string","req":true}
                     }""")
        );
    }

    @Test
    void extractsRepeatedStrings() {
        assertEquals(
            """
            const a="longstring";
            const _data={
              a: a,
              b: a,
              c: a
            };
            """,
            compress("""
                     {"a":"longstring","b":"longstring","c":"longstring"}""")
        );
    }

    @Test
    void doesNotExtractShortOrRareValues() {
        assertEquals(
            """
            const _data={
              x: "ab",
              y: "cd"
            };
            """,
            compress("""
                     {"x":"ab","y":"cd"}""")
        );
    }

    @Test
    void handlesNestedObjects() {
        assertEquals(
            """
            const a={"c":{"fn":"isSet"}};
            const _data={
              r1: a,
              r2: a,
              r3: a
            };
            """,
            compress("""
                     {
                       "r1":{"c":{"fn":"isSet"}},
                       "r2":{"c":{"fn":"isSet"}},
                       "r3":{"c":{"fn":"isSet"}}
                     }""")
        );
    }

    @Test
    void handlesArrays() {
        assertEquals(
            """
            const a={"type":"endpoint","url":"https://example.com"};
            const _data={
              rules: [
                a,
                a,
                a
              ]
            };
            """,
            compress("""
                     {"rules":[
                       {"type":"endpoint","url":"https://example.com"},
                       {"type":"endpoint","url":"https://example.com"},
                       {"type":"endpoint","url":"https://example.com"}
                     ]}""")
        );
    }

    @Test
    void stripsQuotesFromWordOnlyKeys() {
        String result = compress("""
                                 {"simpleKey":"value"}""");
        assertTrue(result.contains("simpleKey:"));
        assertFalse(result.contains("\"simpleKey\":"));
    }

    @Test
    void outputEndsWithNewline() {
        assertTrue(compress("""
                            {"version":"1.0"}""").endsWith("\n"));
    }

    @Test
    void extractsSsaTemplateFunctions() {
        assertEquals(
            """
            const a=(n: number)=>"https://bucket.s3express-zone_ssa_"+n+".region.example.com";
            const _data={
              a: a(1),
              b: a(2),
              c: a(3)
            };
            """,
            compress("""
                     {
                       "a": "https://bucket.s3express-zone_ssa_1.region.example.com",
                       "b": "https://bucket.s3express-zone_ssa_2.region.example.com",
                       "c": "https://bucket.s3express-zone_ssa_3.region.example.com"
                     }""")
        );
    }
}
