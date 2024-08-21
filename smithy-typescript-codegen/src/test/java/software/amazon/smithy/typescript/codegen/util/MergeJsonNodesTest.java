package software.amazon.smithy.typescript.codegen.util;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MergeJsonNodesTest {

    @Test
    void apply() {
        ObjectNode left = ObjectNode.parse("""
            {
                "name": "hello, world",
                "version": 5,
                "scripts": {
                    "target": "exec",
                    "target2": "exec2",
                    "args": ["a", "b", "c"],
                    "nested": {
                        "deep": "."
                    }
                },
                "metadata": {
                    "A": "A",
                    "B": "B",
                    "C": "C"
                }
            }
            """).expectObjectNode();

        ObjectNode right = ObjectNode.parse("""
            {
                "version": 6,
                "scripts": {
                    "target": "no-op",
                    "args": ["a", "b", "c", "d"],
                    "nested": {
                        "option": "b"
                    }
                },
                "metadata": {
                    "A": "A"
                }
            }
            """).expectObjectNode();

        ObjectNode expected = ObjectNode.parse("""
            {
                "name": "hello, world",
                "version": 6,
                "scripts": {
                    "target": "no-op",
                    "target2": "exec2",
                    "args": ["a", "b", "c", "d"],
                    "nested": {
                        "option": "b"
                    }
                },
                "metadata": {
                    "A": "A"
                }
            }
            """).expectObjectNode();

        ObjectNode l = expected;
        ObjectNode r = MergeJsonNodes.mergeWithScripts(left, right);

        assertEquals(
            l.expectStringMember("name"),
            r.expectStringMember("name")
        );
        assertEquals(
            l.expectNumberMember("version"),
            r.expectNumberMember("version")
        );
        assertEquals(
            l.expectObjectMember("scripts").expectStringMember("target"),
            r.expectObjectMember("scripts").expectStringMember("target")
        );
        assertEquals(
            l.expectObjectMember("scripts").expectStringMember("target2"),
            r.expectObjectMember("scripts").expectStringMember("target2")
        );
        assertEquals(
            l.expectObjectMember("scripts").expectArrayMember("args").getElementsAs(Node::toString),
            r.expectObjectMember("scripts").expectArrayMember("args").getElementsAs(Node::toString)
        );
        assertEquals(
            l.expectObjectMember("scripts").expectObjectMember("nested").expectStringMember("option"),
            r.expectObjectMember("scripts").expectObjectMember("nested").expectStringMember("option")
        );
        assertEquals(
            1,
            r.expectObjectMember("scripts").expectObjectMember("nested").getStringMap().size()
        );
        assertEquals(
            1,
            r.expectObjectMember("metadata").getStringMap().size()
        );
    }
}