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
                    List.<MemberShape>of(
                            memberForString, memberForList, memberForMap,
                            MemberShape.builder()
                                    .id("foo.bar#structure$list2")
                                    .target(list.getId())
                                    .build(),
                            MemberShape.builder()
                                    .id("foo.bar#structure$list3")
                                    .target(list.getId())
                                    .build(),
                            MemberShape.builder()
                                    .id("foo.bar#structure$list4")
                                    .target(list.getId())
                                    .build(),
                            MemberShape.builder()
                                    .id("foo.bar#structure$list5")
                                    .target(list.getId())
                                    .build(),
                            MemberShape.builder()
                                    .id("foo.bar#structure$list6")
                                    .target(list.getId())
                                    .build(),
                            MemberShape.builder()
                                    .id("foo.bar#structure$list7")
                                    .target(list.getId())
                                    .build(),
                            MemberShape.builder()
                                    .id("foo.bar#structure$structure")
                                    .target("foo.bar#structure")
                                    .build()))
            .build();

    private Model model = Model.builder()
            .addShapes(
                    string, list, map, structure,
                    memberForString, memberForList, memberForMap)
            .build();

    @Test
    public void generatesStructuralHintDocumentation_map() {
        assertThat(
                StructureExampleGenerator.generateStructuralHintDocumentation(map, model, false),
                equalTo("""
                        { // map
                          "<keys>": "STRING_VALUE",
                        };"""));
    }

    @Test
    public void generatesStructuralHintDocumentation_structure() {
        assertThat(
                StructureExampleGenerator.generateStructuralHintDocumentation(structure, model, false),
                equalTo("""
                        { // structure
                          string: "STRING_VALUE",
                          list: [ // list
                            "STRING_VALUE",
                          ],
                          map: { // map
                            "<keys>": "STRING_VALUE",
                          },
                          list2: [
                            "STRING_VALUE",
                          ],
                          list3: [
                            "STRING_VALUE",
                          ],
                          list4: [
                            "STRING_VALUE",
                          ],
                          list5: [
                            "STRING_VALUE",
                          ],
                          list6: "<list>",
                          list7: "<list>",
                          structure: {
                            string: "STRING_VALUE",
                            list: "<list>",
                            map: {
                              "<keys>": "STRING_VALUE",
                            },
                            list2: "<list>",
                            list3: "<list>",
                            list4: "<list>",
                            list5: "<list>",
                            list6: "<list>",
                            list7: "<list>",
                            structure: "<structure>",
                          },
                        };"""));
    }
    
    @Test
    public void generatesStructuralHintDocumentation_structure_asComment() {
        assertThat(
                StructureExampleGenerator.generateStructuralHintDocumentation(structure, model, true),
                equalTo("""
                        // { // structure
                        //   string: "STRING_VALUE",
                        //   list: [ // list
                        //     "STRING_VALUE",
                        //   ],
                        //   map: { // map
                        //     "<keys>": "STRING_VALUE",
                        //   },
                        //   list2: [
                        //     "STRING_VALUE",
                        //   ],
                        //   list3: [
                        //     "STRING_VALUE",
                        //   ],
                        //   list4: [
                        //     "STRING_VALUE",
                        //   ],
                        //   list5: [
                        //     "STRING_VALUE",
                        //   ],
                        //   list6: "<list>",
                        //   list7: "<list>",
                        //   structure: {
                        //     string: "STRING_VALUE",
                        //     list: "<list>",
                        //     map: {
                        //       "<keys>": "STRING_VALUE",
                        //     },
                        //     list2: "<list>",
                        //     list3: "<list>",
                        //     list4: "<list>",
                        //     list5: "<list>",
                        //     list6: "<list>",
                        //     list7: "<list>",
                        //     structure: "<structure>",
                        //   },
                        // };"""));
    }

    @Test
    public void generatesStructuralHintDocumentation_list() {
        assertThat(
                StructureExampleGenerator.generateStructuralHintDocumentation(list, model, false),
                equalTo("""
                        [ // list
                          "STRING_VALUE",
                        ];"""));
    }
}
