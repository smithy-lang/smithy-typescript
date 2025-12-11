package software.amazon.smithy.typescript.codegen.schema;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.pattern.UriPattern;
import software.amazon.smithy.model.traits.EndpointTrait;
import software.amazon.smithy.model.traits.HttpErrorTrait;
import software.amazon.smithy.model.traits.HttpTrait;
import software.amazon.smithy.model.traits.JsonNameTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.model.traits.XmlAttributeTrait;
import software.amazon.smithy.model.traits.XmlNamespaceTrait;
import software.amazon.smithy.typescript.codegen.util.StringStore;

class SchemaTraitGeneratorTest {

    private static final SchemaTraitGenerator subject = new SchemaTraitGenerator();

    private record TestPair(String expectedSerialization, Trait trait) {
        public void test() {
            assertEquals(expectedSerialization, subject.serializeTraitData(trait, new StringStore()));
        }
    }

    private static final List<TestPair> testCases = List.of(
        // timestamp
        new TestPair("", new TimestampFormatTrait("date-time")),
        // strings
        new TestPair("_jN", new JsonNameTrait("jsonName")),
        // annotations
        new TestPair("1", new XmlAttributeTrait()),
        // data traits
        new TestPair("[\"prefix\"]\n", EndpointTrait.builder().hostPrefix("prefix").build()),
        new TestPair("[_p, _h]\n", XmlNamespaceTrait.builder().prefix("prefix").uri("https://localhost").build()),
        new TestPair("404", new HttpErrorTrait(404)),
        new TestPair(
            "[\"GET\", \"/uri-pattern\", 200]\n",
            HttpTrait.builder().method("GET").uri(UriPattern.parse("/uri-pattern")).code(200).build()
        )
    );

    @Test
    void serializeTraitData() {
        for (TestPair testCase : testCases) {
            testCase.test();
        }
    }
}
