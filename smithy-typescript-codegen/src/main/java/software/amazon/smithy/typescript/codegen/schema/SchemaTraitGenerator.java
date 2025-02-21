/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.schema;

import java.util.Objects;
import java.util.Set;
import software.amazon.smithy.model.traits.AnnotationTrait;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.EventHeaderTrait;
import software.amazon.smithy.model.traits.EventPayloadTrait;
import software.amazon.smithy.model.traits.HostLabelTrait;
import software.amazon.smithy.model.traits.HttpErrorTrait;
import software.amazon.smithy.model.traits.HttpHeaderTrait;
import software.amazon.smithy.model.traits.HttpLabelTrait;
import software.amazon.smithy.model.traits.HttpPayloadTrait;
import software.amazon.smithy.model.traits.HttpPrefixHeadersTrait;
import software.amazon.smithy.model.traits.HttpQueryParamsTrait;
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
    private static final Set<Class<? extends AnnotationTrait>> ANNOTATION_TRAITS = SetUtils.of(
        XmlAttributeTrait.class,
        XmlFlattenedTrait.class,
        EventHeaderTrait.class,
        EventPayloadTrait.class,
        StreamingTrait.class,
        RequiresLengthTrait.class,
        HttpLabelTrait.class,
        HttpPayloadTrait.class,
        HttpQueryParamsTrait.class,
        HttpResponseCodeTrait.class,
        HostLabelTrait.class,
        SparseTrait.class,
        SensitiveTrait.class,
        IdempotencyTokenTrait.class
    );
    private static final Set<Class<? extends Trait>> DATA_TRAITS = SetUtils.of(
        HttpErrorTrait.class,
        HttpTrait.class
    );
    private static final Set<Class<? extends StringTrait>> STRING_TRAITS = SetUtils.of(
        TimestampFormatTrait.class,
        JsonNameTrait.class,
        MediaTypeTrait.class,
        XmlNameTrait.class,
        HttpHeaderTrait.class,
        HttpPrefixHeadersTrait.class,
        ErrorTrait.class
    );

    public String serializeTraitData(Trait trait, StringStore stringStore) {
        if (trait instanceof TimestampFormatTrait) {
            // this is overridden by {@link SchemaGenerator::resolveSchema}
        } else if (STRING_TRAITS.contains(trait.getClass()) && trait instanceof StringTrait strTrait) {
            return stringStore.var(strTrait.getValue());
        } else if (ANNOTATION_TRAITS.contains(trait.getClass()) && trait instanceof AnnotationTrait) {
            return ANNOTATION_TRAIT_VALUE;
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
        return """
            /* unknown trait */\s""" + "`" + trait.getClass().getSimpleName() + "`";
    }
}
