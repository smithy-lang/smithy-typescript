package software.amazon.smithy.typescript.codegen.documentation;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import java.util.List;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;

public class StructureExampleGeneratorTest {

    StringShape string = StringShape.builder()
            .id("foo.bar#string")
            .build();

    ListShape list = ListShape.builder()
            .id("foo.bar#list")
            .member(string.getId())
            .build();

    MapShape map = MapShape.builder()
            .id("foo.bar#map")
            .key(MemberShape.builder()
                    .id("foo.bar#map$member")
                    .target(string.getId())
                    .build())
            .value(MemberShape.builder()
                    .id("foo.bar#map$member")
                    .target(string.getId())
                    .build())
            .build();

    MemberShape memberForString = MemberShape.builder()
            .id("foo.bar#structure$string")
            .target(string.getId())
            .build();

    MemberShape memberForList = MemberShape.builder()
            .id("foo.bar#structure$list")
            .target(list.getId())
            .build();

    MemberShape memberForMap = MemberShape.builder()
            .id("foo.bar#structure$map")
            .target(map.getId())
            .build();

    StructureShape structure = StructureShape.builder()
            .id("foo.bar#structure")
            .members(
                    List.<MemberShape>of(memberForString, memberForList, memberForMap))
            .build();

    private Model model = Model.builder()
            .addShapes(
                    string, list, map, structure,
                    memberForString, memberForList, memberForMap)
            .build();

    @Test
    public void generatesStructuralHintDocumentation_map() {
        assertThat(
                StructureExampleGenerator.generateStructuralHintDocumentation(map, model),
                equalTo("{\n  \"<keys>\": \"STRING_VALUE\", \n};"));
    }

    @Test
    public void generatesStructuralHintDocumentation_structure() {
        assertThat(
                StructureExampleGenerator.generateStructuralHintDocumentation(structure, model),
                equalTo("{\n"
                        + "  string: \"STRING_VALUE\", \n"
                        + "  list: [ \n"
                        + "    \"STRING_VALUE\", \n"
                        + "  ],\n"
                        + "  map: { \n"
                        + "    \"<keys>\": \"STRING_VALUE\", \n"
                        + "  },\n"
                        + "};"));
    }

    @Test
    public void generatesStructuralHintDocumentation_list() {
        assertThat(
                StructureExampleGenerator.generateStructuralHintDocumentation(list, model),
                equalTo("[\n  \"STRING_VALUE\", \n];"));
    }
}
