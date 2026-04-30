/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.node.ArrayNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.rulesengine.language.EndpointRuleSet;
import software.amazon.smithy.rulesengine.logic.bdd.CostOptimization;
import software.amazon.smithy.rulesengine.logic.bdd.NodeReversal;
import software.amazon.smithy.rulesengine.logic.bdd.SiftingOptimization;
import software.amazon.smithy.rulesengine.logic.cfg.Cfg;
import software.amazon.smithy.rulesengine.traits.EndpointBddTrait;
import software.amazon.smithy.typescript.codegen.endpointsV2.ConditionSerializer;
import software.amazon.smithy.typescript.codegen.endpointsV2.RuleSerializer;

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

    @Test
    void doesNotCorruptObjectKeysWhenReplacingWildcardStringValues() {
        EndpointRuleSet ruleSet = EndpointRuleSet.fromNode(Node.parse(
            """
            {
              "version": "1.3",
              "parameters": {
                "ParamA": { "required": false, "type": "String" },
                "ParamB": { "builtIn": "SDK::Endpoint", "required": false, "type": "String" },
                "ParamC": { "required": true, "type": "String", "builtIn": "AWS::Region", "default": "us-east-2" }
              },
              "rules": [
                {
                  "type": "endpoint",
                  "conditions": [
                    { "fn": "isSet", "argv": [{ "ref": "ParamB" }] },
                    { "fn": "stringEquals", "argv": [{ "ref": "ParamC" }, "*"] }
                  ],
                  "endpoint": {
                    "url": { "ref": "ParamB" },
                    "properties": { "authSchemes": [{ "name": "sigv4a", "signingRegionSet": ["*"] }] }
                  }
                },
                {
                  "type": "endpoint",
                  "conditions": [{ "fn": "isSet", "argv": [{ "ref": "ParamB" }] }],
                  "endpoint": { "url": { "ref": "ParamB" } }
                },
                {
                  "type": "endpoint",
                  "conditions": [
                    { "fn": "isSet", "argv": [{ "ref": "ParamA" }] },
                    { "fn": "stringEquals", "argv": [{ "ref": "ParamC" }, "*"] }
                  ],
                  "endpoint": {
                    "url": "https://{ParamA}.global.example.com",
                    "properties": { "authSchemes": [{ "name": "sigv4a", "signingRegionSet": ["*"] }] }
                  }
                },
                {
                  "type": "endpoint",
                  "conditions": [{ "fn": "isSet", "argv": [{ "ref": "ParamA" }] }],
                  "endpoint": {
                    "url": "https://{ParamC}.{ParamA}.example.com",
                    "properties": { "authSchemes": [{ "name": "sigv4", "signingRegion": "{ParamC}" }] }
                  }
                },
                {
                  "type": "endpoint",
                  "conditions": [{ "fn": "stringEquals", "argv": [{ "ref": "ParamC" }, "*"] }],
                  "endpoint": {
                    "url": "https://prod.global.example.com",
                    "properties": { "authSchemes": [{ "name": "sigv4a", "signingRegionSet": ["*"] }] }
                  }
                },
                {
                  "type": "endpoint",
                  "conditions": [],
                  "endpoint": {
                    "url": "https://{ParamC}.prod.example.com",
                    "properties": { "authSchemes": [{ "name": "sigv4", "signingRegion": "{ParamC}" }] }
                  }
                }
              ]
            }"""
        ));

        Cfg cfg = Cfg.from(ruleSet);
        EndpointBddTrait bddTrait = EndpointBddTrait.from(cfg);
        bddTrait = SiftingOptimization.builder().cfg(cfg).build().apply(bddTrait);
        bddTrait = CostOptimization.builder().cfg(cfg).build().apply(bddTrait);
        bddTrait = new NodeReversal().apply(bddTrait);

        ObjectNode conditionsAndResults = ObjectNode.fromStringMap(Collections.emptyMap());
        conditionsAndResults = conditionsAndResults.withMember(
            "conditions",
            ArrayNode.fromNodes(
                bddTrait.getConditions().stream().map(c -> new ConditionSerializer(c).toArrayNode()).toList()
            )
        );
        conditionsAndResults = conditionsAndResults.withMember(
            "results",
            ArrayNode.fromNodes(
                bddTrait.getResults().stream().map(r -> new RuleSerializer(r).toArrayNode()).toList()
            )
        );

        String result = new PatternDetectionCompression(conditionsAndResults).compress();

        assertEquals(
            """
            const f="authSchemes";
            const a="isSet",
            b="*",
            c={"ref":"ParamB"},
            d={[f]:[{"name":"sigv4a","signingRegionSet":[b]}]},
            e={[f]:[{"name":"sigv4","signingRegion":"{ParamC}"}]};
            const _data={
              conditions: [
                [a,[c]],
                ["stringEquals",[{ref:"ParamC"},b]],
                [a,[{ref:"ParamA"}]]
              ],
              results: [
                [-1],
                [c,d],
                [c,{}],
                ["https://{ParamA}.global.example.com",d],
                ["https://{ParamC}.{ParamA}.example.com",e],
                ["https://prod.global.example.com",d],
                ["https://{ParamC}.prod.example.com",e]
              ]
            };
            """,
            result
        );
    }
}
