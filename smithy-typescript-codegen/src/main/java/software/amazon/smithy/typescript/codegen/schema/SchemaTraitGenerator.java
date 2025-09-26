/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.schema;

import java.util.Objects;
import java.util.Set;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.AnnotationTrait;
import software.amazon.smithy.model.traits.EndpointTrait;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.EventHeaderTrait;
import software.amazon.smithy.model.traits.EventPayloadTrait;
import software.amazon.smithy.model.traits.HostLabelTrait;
import software.amazon.smithy.model.traits.HttpChecksumRequiredTrait;
import software.amazon.smithy.model.traits.HttpErrorTrait;
import software.amazon.smithy.model.traits.HttpHeaderTrait;
import software.amazon.smithy.model.traits.HttpLabelTrait;
import software.amazon.smithy.model.traits.HttpPayloadTrait;
import software.amazon.smithy.model.traits.HttpPrefixHeadersTrait;
import software.amazon.smithy.model.traits.HttpQueryParamsTrait;
import software.amazon.smithy.model.traits.HttpQueryTrait;
import software.amazon.smithy.model.traits.HttpResponseCodeTrait;
import software.amazon.smithy.model.traits.HttpTrait;
import software.amazon.smithy.model.traits.IdempotencyTokenTrait;
import software.amazon.smithy.model.traits.JsonNameTrait;
import software.amazon.smithy.model.traits.MediaTypeTrait;
import software.amazon.smithy.model.traits.RequiresLengthTrait;
import software.amazon.smithy.model.traits.SensitiveTrait;
import software.amazon.smithy.model.traits.SparseTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.model.traits.StringTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.model.traits.XmlAttributeTrait;
import software.amazon.smithy.model.traits.XmlFlattenedTrait;
import software.amazon.smithy.model.traits.XmlNameTrait;
import software.amazon.smithy.model.traits.XmlNamespaceTrait;
import software.amazon.smithy.typescript.codegen.util.StringStore;
import software.amazon.smithy.utils.SetUtils;
import software.amazon.smithy.utils.SmithyInternalApi;


/**
 * Creates the string representing a trait's data.
 * For presence-based trait, essentially boolean, a 1 or 2 will be used.
 */
@SmithyInternalApi
public class SchemaTraitGenerator {
    private static final String ANNOTATION_TRAIT_VALUE = "1";
    private static final Set<ShapeId> ANNOTATION_TRAITS = SetUtils.of(
        XmlAttributeTrait.ID,
        XmlFlattenedTrait.ID,
        EventHeaderTrait.ID,
        EventPayloadTrait.ID,
        StreamingTrait.ID,
        RequiresLengthTrait.ID,
        HttpLabelTrait.ID,
        HttpPayloadTrait.ID,
        HttpQueryParamsTrait.ID,
        HttpResponseCodeTrait.ID,
        HttpChecksumRequiredTrait.ID,
        HostLabelTrait.ID,
        SparseTrait.ID,
        SensitiveTrait.ID,
        IdempotencyTokenTrait.ID
    );

    /**
     * Data traits are traits with one or more fields of data.
     * To allow for the possibility of the traits adding new fields,
     * the generated schema object MUST be an array with consistent ordering and size
     * for the fields' data.
     */
    private static final Set<ShapeId> DATA_TRAITS = SetUtils.of(
        HttpErrorTrait.ID,
        HttpTrait.ID,
        EndpointTrait.ID,
        XmlNamespaceTrait.ID
    );

    private static final Set<ShapeId> STRING_TRAITS = SetUtils.of(
        TimestampFormatTrait.ID,
        JsonNameTrait.ID,
        MediaTypeTrait.ID,
        XmlNameTrait.ID,
        HttpHeaderTrait.ID,
        HttpQueryTrait.ID,
        HttpPrefixHeadersTrait.ID,
        ErrorTrait.ID
    );

    public String serializeTraitData(Trait trait, StringStore stringStore) {
        if (trait instanceof TimestampFormatTrait) {
            // this is overridden by {@link SchemaGenerator::resolveSchema}
            return "";
        } else if (STRING_TRAITS.contains(trait.toShapeId()) && trait instanceof StringTrait strTrait) {
            return stringStore.var(strTrait.getValue());
        } else if (ANNOTATION_TRAITS.contains(trait.toShapeId()) && trait instanceof AnnotationTrait) {
            return ANNOTATION_TRAIT_VALUE;
        } else if (DATA_TRAITS.contains(trait.toShapeId())) {
            if (trait instanceof EndpointTrait endpointTrait) {
                return """
                    ["%s"]
                    """.formatted(endpointTrait.getHostPrefix());
            } else if (trait instanceof XmlNamespaceTrait xmlNamespaceTrait) {
                return """
                [%s, %s]
                """.formatted(
                    stringStore.var(xmlNamespaceTrait.getPrefix().orElse("")),
                    stringStore.var(xmlNamespaceTrait.getUri())
                );
            } else if (trait instanceof HttpErrorTrait httpError) {
                return Objects.toString(httpError.getCode());
            } else if (trait instanceof HttpTrait httpTrait) {
                return """
                ["%s", "%s", %s]
                """.formatted(
                    httpTrait.getMethod(),
                    httpTrait.getUri(),
                    httpTrait.getCode()
                );
            }
        } else if (SchemaTraitExtension.INSTANCE.contains(trait)) {
            return SchemaTraitExtension.INSTANCE.render(trait);
        }

        if (trait instanceof StringTrait stringTrait) {
            return """
            /* unhandled trait \s""" + "`" + trait.getClass().getSimpleName() + "` */ "
                + stringStore.var(stringTrait.getValue());
        } else if (trait instanceof AnnotationTrait) {
            return """
            /* unhandled trait \s""" + "`" + trait.getClass().getSimpleName() + "` */ "
                + ANNOTATION_TRAIT_VALUE;
        }
        return """
            /* unhandled trait \s""" + "`" + trait.getClass().getSimpleName() + "` */ void 0";
    }
}
