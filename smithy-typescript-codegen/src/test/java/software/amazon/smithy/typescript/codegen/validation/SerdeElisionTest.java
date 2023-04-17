package software.amazon.smithy.typescript.codegen.validation;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.FloatShape;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.IdempotencyTokenTrait;

public class SerdeElisionTest {
    StringShape string = StringShape.builder()
        .id("foo.bar#string_a")
        .build();

    StringShape stringWithTrait = StringShape.builder()
        .id("foo.bar#stringWithTrait")
        .traits(Collections.singleton(new IdempotencyTokenTrait()))
        .build();

    FloatShape floaty = FloatShape.builder()
        .id("foo.bar#float")
        .build();

    @Test
    public void mayElide_simpleObjects() {
        Model model = getModel(string);
        SerdeElision serdeElision = SerdeElision.forModel(getModel(string)).setEnabledForModel(true);

        assertThat(serdeElision.mayElide(model.getShape(ShapeId.from("foo.bar#string")).get()), equalTo(true));
        assertThat(serdeElision.mayElide(model.getShape(ShapeId.from("foo.bar#list")).get()), equalTo(true));
        assertThat(serdeElision.mayElide(model.getShape(ShapeId.from("foo.bar#map")).get()), equalTo(true));
        assertThat(serdeElision.mayElide(model.getShape(ShapeId.from("foo.bar#structure")).get()), equalTo(true));
    }

    @Test
    public void mayElide_hasBooleanGate() {
        Model model = getModel(stringWithTrait);
        SerdeElision serdeElision = SerdeElision.forModel(model).setEnabledForModel(false);

        assertThat(serdeElision.mayElide(model.getShape(ShapeId.from("foo.bar#string")).get()), equalTo(false));
        assertThat(serdeElision.mayElide(model.getShape(ShapeId.from("foo.bar#list")).get()), equalTo(false));
        assertThat(serdeElision.mayElide(model.getShape(ShapeId.from("foo.bar#map")).get()), equalTo(false));
        assertThat(serdeElision.mayElide(model.getShape(ShapeId.from("foo.bar#structure")).get()), equalTo(false));
    }

    @Test
    public void mayElide_bailsOnTypes() {
        Model model = getModel(floaty);
        SerdeElision serdeElision = SerdeElision.forModel(model).setEnabledForModel(true);

        // string doesn't include float.
        assertThat(serdeElision.mayElide(model.getShape(ShapeId.from("foo.bar#string")).get()), equalTo(true));

        // others contain float and cannot qualify.
        assertThat(serdeElision.mayElide(model.getShape(ShapeId.from("foo.bar#list")).get()), equalTo(false));
        assertThat(serdeElision.mayElide(model.getShape(ShapeId.from("foo.bar#map")).get()), equalTo(false));
        assertThat(serdeElision.mayElide(model.getShape(ShapeId.from("foo.bar#structure")).get()), equalTo(false));
    }

    private Model getModel(Shape buildingBlock) {
        StringShape string = StringShape.builder()
            .id("foo.bar#string")
            .build();

        ListShape list = ListShape.builder()
            .id("foo.bar#list")
            .member(buildingBlock.getId())
            .build();

        MapShape map = MapShape.builder()
            .id("foo.bar#map")
            .key(MemberShape.builder()
                    .id("foo.bar#map$member")
                    .target(string.getId())
                    .build())
            .value(MemberShape.builder()
                    .id("foo.bar#map$member")
                    .target(buildingBlock.getId())
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

        MemberShape memberForBuildingBlock = MemberShape.builder()
            .id("foo.bar#structure$buildingBlock")
            .target(buildingBlock.getId())
            .build();

        StructureShape structure = StructureShape.builder()
            .id("foo.bar#structure")
            .members(
                List.<MemberShape>of(
                    memberForString, memberForList, memberForMap,
                    memberForBuildingBlock
                )
            )
            .build();

        Model model = Model.builder()
            .addShapes(
                string, list, map, structure, buildingBlock,
                memberForString, memberForList, memberForMap, memberForBuildingBlock
            )
            .build();

        return model;
    }
}
