package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.util.List;
import java.util.Optional;
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

        RuleSetParameterFinder subject = new RuleSetParameterFinder(serviceShape);

        List<String> effectiveParams = subject.getEffectiveParams();

        assertEquals(List.of("BasicParameter", "NestedParameter", "UrlOnlyParameter"), effectiveParams);
    }
}