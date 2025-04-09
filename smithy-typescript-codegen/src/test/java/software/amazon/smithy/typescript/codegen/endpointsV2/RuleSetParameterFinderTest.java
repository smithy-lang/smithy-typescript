package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.rulesengine.language.EndpointRuleSet;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RuleSetParameterFinderTest {
    RuleSetParameterFinder subject;

    Node ruleSet = Node.parse("""
            {
              "version": "1.0",
              "parameters": {
                "BasicParameter": {
                  "required": false,
                  "documentation": "...",
                  "type": "String"
                },
                "NestedParameter": {
                  "required": true,
                  "documentation": "...",
                  "type": "Boolean"
                },
                "UrlOnlyParameter": {
                  "required": true,
                  "documentation": "...",
                  "type": "String"
                },
                "UnusedParameter": {
                  "required": false,
                  "documentation": "...",
                  "type": "String"
                },
                "ShorthandParameter": {
                  "required": true,
                  "documentation": "...",
                  "type": "String"
                }
              },
              "rules": [
                {
                  "conditions": [
                    {
                      "fn": "isSet",
                      "argv": [
                        {
                          "ref": "BasicParameter"
                        }
                      ]
                    }
                  ],
                  "rules": [
                    {
                      "conditions": [
                        {
                          "fn": "booleanEquals",
                          "argv": [
                            {
                              "fn": "booleanEquals",
                              "argv": [
                                {
                                  "fn": "booleanEquals",
                                  "argv": [
                                    {
                                      "fn": "booleanEquals",
                                      "argv": [
                                        {
                                          "ref": "NestedParameter"
                                        },
                                        true
                                      ]
                                    },
                                    true
                                  ]
                                },
                                true
                              ]
                            },
                            true
                          ]
                        },
                        {
                          "fn": "stringEquals",
                          "argv": [
                            "literal",
                            "{ShorthandParameter}"
                          ]
                        }
                      ],
                      "endpoint": {
                        "url": "https://www.{BasicParameter}.{UrlOnlyParameter}.com",
                        "properties": {},
                        "headers": {}
                      },
                      "type": "endpoint"
                    }
                  ],
                  "type": "tree"
                }
              ]
            }
            """);


    @Test
    void getEffectiveParams(@Mock ServiceShape serviceShape, @Mock EndpointRuleSetTrait endpointRuleSetTrait) {
        EndpointRuleSet endpointRuleSet = EndpointRuleSet.fromNode(ruleSet);
        when(serviceShape.getTrait(EndpointRuleSetTrait.class)).thenReturn(Optional.of(endpointRuleSetTrait));
        when(endpointRuleSetTrait.getEndpointRuleSet()).thenReturn(endpointRuleSet);
        subject = new RuleSetParameterFinder(serviceShape);

        List<String> effectiveParams = subject.getEffectiveParams();

        assertEquals(List.of("BasicParameter", "NestedParameter", "ShorthandParameter", "UrlOnlyParameter"), effectiveParams);
    }

    @Test
    void getJmesPathExpression(@Mock ServiceShape serviceShape, @Mock EndpointRuleSetTrait endpointRuleSetTrait) {
        when(serviceShape.getTrait(EndpointRuleSetTrait.class)).thenReturn(Optional.of(endpointRuleSetTrait));
        subject = new RuleSetParameterFinder(serviceShape);

        assertEquals(
            """
            Object.keys(input?.RequestItems ?? {})""",
            subject.getJmesPathExpression("?.", "input", "keys(RequestItems)")
        );

        assertEquals(
            """
            input?.TableCreationParameters?.TableName""",
            subject.getJmesPathExpression("?.", "input", "TableCreationParameters.TableName")
        );

        assertEquals(
            """
            input?.TransactItems?.map((obj: any) => obj?.Get?.TableName""",
            subject.getJmesPathExpression("?.", "input", "TransactItems[*].Get.TableName")
        );

        assertEquals(
            """
            input?.TransactItems?.map((obj: any) => [obj?.ConditionCheck?.TableName,obj?.Put?.TableName,obj?.Delete?.TableName,obj?.Update?.TableName].filter((i) => i)).flat()""",
            subject.getJmesPathExpression("?.", "input", "TransactItems[*].[ConditionCheck.TableName, Put.TableName, Delete.TableName, Update.TableName][]")
        );
    }
}