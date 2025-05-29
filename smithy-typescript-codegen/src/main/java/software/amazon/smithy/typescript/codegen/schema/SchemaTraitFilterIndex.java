/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.schema;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.KnowledgeIndex;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.EndpointTrait;
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
import software.amazon.smithy.model.traits.HttpQueryTrait;
import software.amazon.smithy.model.traits.HttpResponseCodeTrait;
import software.amazon.smithy.model.traits.HttpTrait;
import software.amazon.smithy.model.traits.IdempotencyTokenTrait;
import software.amazon.smithy.model.traits.JsonNameTrait;
import software.amazon.smithy.model.traits.MediaTypeTrait;
import software.amazon.smithy.model.traits.ProtocolDefinitionTrait;
import software.amazon.smithy.model.traits.RequiresLengthTrait;
import software.amazon.smithy.model.traits.SensitiveTrait;
import software.amazon.smithy.model.traits.SparseTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.model.traits.TraitDefinition;
import software.amazon.smithy.model.traits.XmlAttributeTrait;
import software.amazon.smithy.model.traits.XmlFlattenedTrait;
import software.amazon.smithy.model.traits.XmlNameTrait;
import software.amazon.smithy.model.traits.XmlNamespaceTrait;
import software.amazon.smithy.utils.SetUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
final class SchemaTraitFilterIndex implements KnowledgeIndex {
    private final Set<ShapeId> includedTraits = new HashSet<>(
        SetUtils.of(
            SparseTrait.ID,
            // excluded by special schema handling.
            // TimestampFormatTrait.ID,
            SensitiveTrait.ID,
            IdempotencyTokenTrait.ID,
            JsonNameTrait.ID,
            MediaTypeTrait.ID,
            XmlAttributeTrait.ID,
            XmlFlattenedTrait.ID,
            XmlNameTrait.ID,
            XmlNamespaceTrait.ID,
            EventHeaderTrait.ID,
            EventPayloadTrait.ID,
            StreamingTrait.ID,
            RequiresLengthTrait.ID,
            EndpointTrait.ID,
            HttpErrorTrait.ID,
            HttpHeaderTrait.ID,
            HttpQueryTrait.ID,
            HttpLabelTrait.ID,
            HttpPayloadTrait.ID,
            HttpPrefixHeadersTrait.ID,
            HttpQueryParamsTrait.ID,
            HttpResponseCodeTrait.ID,
            HostLabelTrait.ID,
            ErrorTrait.ID,
            HttpTrait.ID
        )
    );
    private final Map<Shape, Boolean> cache = new HashMap<>();
    private final Model model;

    SchemaTraitFilterIndex(Model model) {
        Set<Shape> shapesWithTrait = model.getShapesWithTrait(ProtocolDefinitionTrait.class);
        for (Shape shape : shapesWithTrait) {
            // todo(schema) use protocol and authDefinition traits as the initial allowlist.
            // System.out.println("shape having authDef: " + shape.getId().getName());
            shape.getTrait(ProtocolDefinitionTrait.class).ifPresent(protocolDefinitionTrait -> {
                protocolDefinitionTrait.getTraits().forEach(traitShapeId -> {
                    Shape traitShape = model.expectShape(traitShapeId);
                    TraitDefinition traitDefinition = model.getTraitDefinition(traitShapeId).get();
                    // System.out.println("\t trait shape: " + traitShapeId.getName());
                });
            });
        }

        this.model = model;
        for (Shape shape : model.toSet()) {
            cache.put(shape, hasSchemaTraits(shape));
        }
    }

    public static SchemaTraitFilterIndex of(Model model) {
        return model.getKnowledge(SchemaTraitFilterIndex.class, SchemaTraitFilterIndex::new);
    }

    /**
     * @param shape - structure or member, usually.
     * @return whether it has at least 1 trait that is needed in a schema.
     */
    public boolean hasSchemaTraits(Shape shape) {
        return hasSchemaTraits(shape, 0);
    }

    public boolean hasSchemaTraits(Shape shape, int depth) {
        if (cache.containsKey(shape)) {
            return cache.get(shape);
        }
        if (depth > 20) {
            return false;
        }
        boolean hasSchemaTraits = shape.getAllTraits()
            .values()
            .stream()
            .map(Trait::toShapeId)
            .anyMatch(this::includeTrait);

        if (hasSchemaTraits) {
            cache.put(shape, true);
            return true;
        }

        boolean membersHaveSchemaTraits = shape.getAllMembers().values().stream()
            .anyMatch(ms -> hasSchemaTraits(ms, depth + 1));
        boolean targetHasSchemaTraits = shape.asMemberShape()
            .map(ms -> hasSchemaTraits(model.expectShape(ms.getTarget()), depth + 1))
            .orElse(false);

        cache.put(shape, membersHaveSchemaTraits || targetHasSchemaTraits);
        return cache.get(shape);
    }

    /**
     * @param traitShapeId - query.
     * @return whether trait should be included in schema generation.
     */
    public boolean includeTrait(ShapeId traitShapeId) {
        return includedTraits.contains(traitShapeId) || SchemaTraitExtension.INSTANCE.contains(traitShapeId);
    }
}
