/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.validation;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import java.util.Collections;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.SensitiveTrait;

public class SensitiveDataFinderTest {
    StringShape sensitiveString = StringShape.builder()
            .addTrait(new SensitiveTrait())
            .id("foo.bar#sensitiveString")
            .build();

    StringShape dullString = StringShape.builder()
            .id("foo.bar#dullString")
            .build();

    MemberShape memberWithSensitiveData = MemberShape.builder()
            .id("foo.bar#sensitive$member")
            .target(sensitiveString.getId())
            .build();

    MemberShape memberWithDullData = MemberShape.builder()
            .id("foo.bar#dull$member")
            .target(dullString.getId())
            .build();

    MemberShape listMemberWithSensitiveData = MemberShape.builder()
            .id("foo.bar#listSensitive$member")
            .target(sensitiveString.getId())
            .build();

    MemberShape listMemberWithDullData = MemberShape.builder()
            .id("foo.bar#listDull$member")
            .target(dullString.getId())
            .build();

    MemberShape mapMemberWithSensitiveKeyData = MemberShape.builder()
            .id("foo.bar#mapSensitiveKey$member")
            .target(sensitiveString.getId())
            .build();

    MemberShape mapMemberWithSensitiveValueData = MemberShape.builder()
            .id("foo.bar#mapSensitiveValue$member")
            .target(sensitiveString.getId())
            .build();

    StructureShape structureShapeSensitive = StructureShape.builder()
            .id("foo.bar#sensitive")
            .members(
                    Collections.singleton(memberWithSensitiveData))
            .build();

    StructureShape structureShapeDull = StructureShape.builder()
            .id("foo.bar#dull")
            .members(
                    Collections.singleton(memberWithDullData))
            .build();

    CollectionShape collectionSensitive = ListShape.builder()
            .id("foo.bar#listSensitive")
            .addMember(listMemberWithSensitiveData)
            .build();

    CollectionShape collectionDull = ListShape.builder()
            .id("foo.bar#listDull")
            .addMember(listMemberWithDullData)
            .build();

    MapShape mapSensitiveKey = MapShape.builder()
            .id("foo.bar#mapSensitiveKey")
            .key(mapMemberWithSensitiveKeyData)
            .value(MemberShape.builder()
                    .id("foo.bar#mapSensitiveKey$key")
                    .target(dullString.getId())
                    .build())
            .build();

    MapShape mapSensitiveValue = MapShape.builder()
            .id("foo.bar#mapSensitiveValue")
            .key(MemberShape.builder()
                    .id("foo.bar#mapSensitiveValue$key")
                    .target(dullString.getId())
                    .build())
            .value(mapMemberWithSensitiveValueData)
            .build();

    MapShape mapDull = MapShape.builder()
            .id("foo.bar#mapDull")
            .key(MemberShape.builder()
                    .id("foo.bar#mapDull$key")
                    .target(dullString.getId())
                    .build())
            .value(MemberShape.builder()
                    .id("foo.bar#mapDull$value")
                    .target(dullString.getId())
                    .build())
            .build();

    MapShape nested2 = MapShape.builder()
            .id("foo.bar#mapNested2")
            .key(MemberShape.builder()
                    .id("foo.bar#mapNested2$key")
                    .target(dullString.getId())
                    .build())
            .value(MemberShape.builder()
                    .id("foo.bar#mapNested2$value")
                    .target(mapSensitiveValue)
                    .build())
            .build();

    MapShape nested = MapShape.builder()
            .id("foo.bar#mapNested")
            .key(MemberShape.builder()
                    .id("foo.bar#mapNested$key")
                    .target(dullString.getId())
                    .build())
            .value(MemberShape.builder()
                    .id("foo.bar#mapNested$value")
                    .target(nested2)
                    .build())
            .build();

    private Model model = Model.builder()
            .addShapes(
                    sensitiveString,
                    dullString,
                    memberWithSensitiveData,
                    memberWithDullData,
                    structureShapeSensitive,
                    structureShapeDull,
                    collectionSensitive,
                    collectionDull,
                    mapSensitiveKey,
                    mapSensitiveValue,
                    mapDull,
                    nested,
                    nested2)
            .build();

    private SensitiveDataFinder sensitiveDataFinder = new SensitiveDataFinder(model);

    @Test
    public void findsSensitiveData_inShapes() {
        assertThat(sensitiveDataFinder.findsSensitiveDataIn(sensitiveString), equalTo(true));
        assertThat(sensitiveDataFinder.findsSensitiveDataIn(dullString), equalTo(false));
    }

    @Test
    public void findsSensitiveData_inTargetShapes() {
        assertThat(sensitiveDataFinder.findsSensitiveDataIn(memberWithSensitiveData), equalTo(true));
        assertThat(sensitiveDataFinder.findsSensitiveDataIn(memberWithDullData), equalTo(false));
    }

    @Test
    public void findsSensitiveData_inStructures() {
        assertThat(sensitiveDataFinder.findsSensitiveDataIn(structureShapeSensitive), equalTo(true));
        assertThat(sensitiveDataFinder.findsSensitiveDataIn(structureShapeDull), equalTo(false));
    }

    @Test
    public void findsSensitiveData_inCollections() {
        assertThat(sensitiveDataFinder.findsSensitiveDataIn(collectionSensitive), equalTo(true));
        assertThat(sensitiveDataFinder.findsSensitiveDataIn(collectionDull), equalTo(false));
    }

    @Test
    public void findsSensitiveData_inMaps() {
        assertThat(sensitiveDataFinder.findsSensitiveDataIn(mapSensitiveKey), equalTo(true));
        assertThat(sensitiveDataFinder.findsSensitiveDataIn(mapSensitiveValue), equalTo(true));
        assertThat(sensitiveDataFinder.findsSensitiveDataIn(mapDull), equalTo(false));
    }

    @Test
    public void findsSensitiveData_deeplyNested() {
        assertThat(sensitiveDataFinder.findsSensitiveDataIn(nested), equalTo(true));
    }
}
