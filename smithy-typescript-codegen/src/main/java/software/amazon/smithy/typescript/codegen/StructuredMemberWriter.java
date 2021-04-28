/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

package software.amazon.smithy.typescript.codegen;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.SimpleShape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.EnumTrait;
import software.amazon.smithy.model.traits.IdempotencyTokenTrait;
import software.amazon.smithy.model.traits.LengthTrait;
import software.amazon.smithy.model.traits.PatternTrait;
import software.amazon.smithy.model.traits.RangeTrait;
import software.amazon.smithy.model.traits.RequiredTrait;
import software.amazon.smithy.model.traits.SensitiveTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.model.traits.UniqueItemsTrait;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates objects, interfaces, enums, etc.
 *
 * TODO: Replace this with a builder for generating classes and interfaces.
 */
@SmithyInternalApi
final class StructuredMemberWriter {

    Model model;
    SymbolProvider symbolProvider;
    Collection<MemberShape> members;
    String memberPrefix = "";
    boolean noDocs;
    final Set<String> skipMembers = new HashSet<>();

    StructuredMemberWriter(Model model, SymbolProvider symbolProvider, Collection<MemberShape> members) {
        this.model = model;
        this.symbolProvider = symbolProvider;
        this.members = new LinkedHashSet<>(members);
    }

    void writeMembers(TypeScriptWriter writer, Shape shape) {
        int position = -1;
        for (MemberShape member : members) {
            if (skipMembers.contains(member.getMemberName())) {
                continue;
            }

            position++;
            boolean wroteDocs = !noDocs && writer.writeMemberDocs(model, member);
            String memberName = getSanitizedMemberName(member);
            String optionalSuffix = shape.isUnionShape() || !isRequiredMember(member) ? "?" : "";
            String typeSuffix = isRequiredMember(member) ? " | undefined" : "";
            writer.write("${L}${L}${L}: ${T}${L};", memberPrefix, memberName, optionalSuffix,
                         symbolProvider.toSymbol(member), typeSuffix);

            if (wroteDocs && position < members.size() - 1) {
                writer.write("");
            }
        }
    }

    void writeFilterSensitiveLog(TypeScriptWriter writer, String objectParam) {
        writer.write("...$L,", objectParam);
        for (MemberShape member : members) {
            if (isMemberOverwriteRequired(member, new HashSet<String>())) {
                String memberName = getSanitizedMemberName(member);
                writer.openBlock("...($1L.$2L && { $2L: ", "}),", objectParam, memberName, () -> {
                    String memberParam = String.format("%s.%s", objectParam, memberName);
                    writeMemberFilterSensitiveLog(writer, member, memberParam);
                });
            }
        }
    }

    void writeMemberFilterSensitiveLog(TypeScriptWriter writer, MemberShape member, String memberParam) {
        Shape memberTarget = model.expectShape(member.getTarget());
        if (member.getMemberTrait(model, SensitiveTrait.class).isPresent()) {
            writeSensitiveString(writer);
        } else if (memberTarget instanceof SimpleShape) {
            writer.write(memberParam);
        } else if (memberTarget.isStructureShape() || memberTarget.isUnionShape()) {
            writeStructureFilterSensitiveLog(writer, memberTarget, memberParam);
        } else if (memberTarget instanceof CollectionShape) {
            MemberShape collectionMember = ((CollectionShape) memberTarget).getMember();
            writeCollectionFilterSensitiveLog(writer, collectionMember, memberParam);
        } else if (memberTarget instanceof MapShape) {
            MemberShape mapMember = ((MapShape) memberTarget).getValue();
            writeMapFilterSensitiveLog(writer, mapMember, memberParam);
        } else {
            throw new CodegenException(String.format(
                "MemberFilterSensitiveLog attempted for %s", memberTarget.getType()
            ));
        }
    }

    /**
     * Writes a constructor function that takes in an object allowing modeled fields to be initialized.
     */
    void writeConstructor(TypeScriptWriter writer, Shape shape) {
        writer.openBlock("constructor(opts: {", "}) {", () -> {
            writeMembers(writer, shape);
        });
        writer.indent();

        for (MemberShape member : members) {
            if (skipMembers.contains(member.getMemberName())) {
                continue;
            }

            writer.write("this.${1L} = opts.${1L};", getSanitizedMemberName(member));
        }

        writer.closeBlock("}");
    }

    /**
     * Writes SENSITIVE_STRING to hide the value of sensitive members.
     */
    private void writeSensitiveString(TypeScriptWriter writer) {
        writer.addImport("SENSITIVE_STRING", "SENSITIVE_STRING", "@aws-sdk/smithy-client");
        writer.write("SENSITIVE_STRING");
    }

    /**
     * Recursively writes filterSensitiveLog for StructureShape.
     */
    private void writeStructureFilterSensitiveLog(
            TypeScriptWriter writer,
            Shape structureTarget,
            String structureParam
    ) {
        if (structureTarget.hasTrait(SensitiveTrait.class)) {
            writeSensitiveString(writer);
        } else if (structureTarget.hasTrait(StreamingTrait.class) && structureTarget.isUnionShape()) {
            // disable logging for StreamingTrait
            writer.write("'STREAMING_CONTENT'");
        } else {
            // Call filterSensitiveLog on Structure.
            writer.write("$T.filterSensitiveLog($L)", symbolProvider.toSymbol(structureTarget), structureParam);
        }
    }

    /**
     * Recursively writes filterSensitiveLog for CollectionShape.
     */
    private void writeCollectionFilterSensitiveLog(
            TypeScriptWriter writer,
            MemberShape collectionMember,
            String collectionParam
    ) {
        if (collectionMember.getMemberTrait(model, SensitiveTrait.class).isPresent()) {
            writeSensitiveString(writer);
        } else if (model.expectShape(collectionMember.getTarget()) instanceof SimpleShape) {
            writer.write(collectionParam);
        } else {
            writer.openBlock("$L.map(", ")", collectionParam, () -> {
                String itemParam = "item";
                writer.write("$L => ", itemParam);
                writeMemberFilterSensitiveLog(writer, collectionMember, itemParam);
            });
        }
    }

    /**
     * Recursively writes filterSensitiveLog for MapShape.
     */
    private void writeMapFilterSensitiveLog(TypeScriptWriter writer, MemberShape mapMember, String mapParam) {
        if (mapMember.getMemberTrait(model, SensitiveTrait.class).isPresent()) {
            writeSensitiveString(writer);
        } else if (model.expectShape(mapMember.getTarget()) instanceof SimpleShape) {
            writer.write(mapParam);
        } else {
            String accParam = "acc"; // accumulator for the reducer
            String keyParam = "key"; // key of the Object.entries() key-value pair
            String valueParam = "value"; // value of the Object.entries() key-value pair

            // Reducer is common to all shapes.
            writer.openBlock("Object.entries($L).reduce(($L: any, [$L, $L]: [string, $T]) => ({", "}), {})",
                mapParam, accParam, keyParam, valueParam, symbolProvider.toSymbol(mapMember), () -> {
                    writer.write("...$L,", accParam);
                    writer.openBlock("[$L]: ", ",", keyParam, () -> {
                        writeMemberFilterSensitiveLog(writer, mapMember, valueParam);
                    });
                }
            );
        }
    }

    /**
     * Identifies if member needs to be overwritten in filterSensitiveLog.
     *
     * @param member a {@link MemberShape} to check if overwrite is required.
     * @param parents a set of membernames which are parents of existing member to avoid unending recursion.
     * @return Returns true if the overwrite is required on member.
     */
    private boolean isMemberOverwriteRequired(MemberShape member, Set<String> parents) {
        if (member.getMemberTrait(model, SensitiveTrait.class).isPresent()) {
            return true;
        }

        Shape memberTarget = model.expectShape(member.getTarget());
        if (memberTarget.isUnionShape()) {
            // always call filterSensitiveLog for UnionShape
            return true;
        } else if (memberTarget.isStructureShape()) {
            if (!parents.contains(symbolProvider.toMemberName(member))) {
                parents.add(symbolProvider.toMemberName(member));
                Collection<MemberShape> structureMemberList = ((StructureShape) memberTarget).getAllMembers().values();
                for (MemberShape structureMember: structureMemberList) {
                    if (!parents.contains(symbolProvider.toMemberName(structureMember))
                            && isMemberOverwriteRequired(structureMember, parents)) {
                        return true;
                    }
                }
            }
        } else if (memberTarget instanceof CollectionShape) {
            MemberShape collectionMember = ((CollectionShape) memberTarget).getMember();
            return isMemberOverwriteRequired(collectionMember, parents);
        } else if (memberTarget instanceof MapShape) {
            MemberShape mapMember = ((MapShape) memberTarget).getValue();
            return isMemberOverwriteRequired(mapMember, parents);
        }
        return false;
    }

    /**
     * Returns the member name to be used in generation.
     *
     * @param member a {@link MemberShape} to be sanitized.
     * @return Returns the member name to be used in generation.
     */
    private String getSanitizedMemberName(MemberShape member) {
        return TypeScriptUtils.sanitizePropertyName(symbolProvider.toMemberName(member));
    }

    /**
     * Identifies if a member should be required on the generated interface.
     *
     * Members that are idempotency tokens should have their required state
     * relaxed so the token can be auto-filled for end users. From docs:
     *
     * "Client implementations MAY automatically provide a value for a request
     * token member if and only if the member is not explicitly provided."
     *
     * @param member The member being generated for.
     * @return If the interface member should be treated as required.
     *
     * @see <a href="https://awslabs.github.io/smithy/spec/core.html#idempotencytoken-trait">Smithy idempotencyToken trait.</a>
     */
    private boolean isRequiredMember(MemberShape member) {
        return member.isRequired() && !member.hasTrait(IdempotencyTokenTrait.class);
    }

    /**
     * Writes a const map of member validators into the namespace for use by the validate method.
     *
     * @param writer the writer for the type, currently positioned in the type's exported namespace
     */
    void writeMemberValidators(TypeScriptWriter writer) {
        writer.openBlock("const memberValidators = {", "};", () -> {
            for (MemberShape member : members) {
                final Shape targetShape = model.expectShape(member.getTarget());
                Collection<Trait> constraintTraits = getConstraintTraits(member);
                writer.writeInline("$L: ", getSanitizedMemberName(member));
                writeShapeValidator(writer, targetShape, constraintTraits);
            }
        });
    }

    private void writeShapeValidator(TypeScriptWriter writer, Shape shape, Collection<Trait> constraintTraits) {
        if (shape.isStructureShape() || shape.isUnionShape()) {
            writer.addImport("CompositeStructureValidator",
                    "__CompositeStructureValidator",
                    "@aws-smithy/server-common");
            writer.openBlock("new __CompositeStructureValidator<$T>(", "),",
                symbolProvider.toSymbol(shape),
                () -> {
                    writeCompositeValidator(writer, shape, constraintTraits);
                    writer.write("$T.validate,", symbolProvider.toSymbol(shape));
                }
            );
        } else if (shape.isListShape() || shape.isSetShape()) {
            writer.addImport("CompositeCollectionValidator",
                    "__CompositeCollectionValidator",
                    "@aws-smithy/server-common");
            MemberShape collectionMemberShape = ((CollectionShape) shape).getMember();
            Shape collectionMemberTargetShape = model.expectShape(collectionMemberShape.getTarget());
            writer.openBlock("new __CompositeCollectionValidator<$T>(", "),",
                    symbolProvider.toSymbol(collectionMemberTargetShape),
                    () -> {
                        writeCompositeValidator(writer, shape, constraintTraits);
                        writeShapeValidator(writer,
                                            collectionMemberTargetShape,
                                            getConstraintTraits(collectionMemberShape));
                    });
        } else if (shape.isMapShape()) {
            writer.addImport("CompositeMapValidator",
                    "__CompositeMapValidator",
                    "@aws-smithy/server-common");
            MapShape mapShape = (MapShape) shape;
            final MemberShape keyShape = mapShape.getKey();
            final MemberShape valueShape = mapShape.getValue();
            writer.openBlock("new __CompositeMapValidator<$T>(", "),",
                    symbolProvider.toSymbol(model.expectShape(valueShape.getTarget())),
                    () -> {
                        writeCompositeValidator(writer, mapShape, constraintTraits);
                        writeShapeValidator(writer,
                                            model.expectShape(keyShape.getTarget()),
                                            getConstraintTraits(keyShape));
                        writeShapeValidator(writer,
                                            model.expectShape(valueShape.getTarget()),
                                            getConstraintTraits(valueShape));
                    });
        } else if (shape instanceof SimpleShape) {
            writeCompositeValidator(writer, shape, constraintTraits);
        } else {
            throw new IllegalArgumentException(
                    String.format("Unsupported shape found when generating validator: %s", shape));
        }
    }

    private void writeCompositeValidator(TypeScriptWriter writer,
                                         Shape shape,
                                         Collection<Trait> constraints) {
        if (constraints.isEmpty()) {
            writer.addImport("NoOpValidator", "__NoOpValidator", "@aws-smithy/server-common");
            writer.write("new __NoOpValidator(),");
            return;
        }
        writer.addImport("CompositeValidator",
                "__CompositeValidator",
                "@aws-smithy/server-common");

        Symbol symbol;
        if (shape instanceof StringShape) {
            // Don't let the TypeScript type for an enum narrow our validator's type too much
            symbol = symbolProvider.toSymbol(model.expectShape(ShapeId.from("smithy.api#String")));
        } else {
            symbol = symbolProvider.toSymbol(shape);
        }

        writer.openBlock("new __CompositeValidator<$T>([", "]),", symbol,
            () -> {
                for (Trait t : constraints) {
                    writeValidator(writer, t);
                }
            }
        );
    }

    void writeValidate(TypeScriptWriter writer, String param) {
        writer.openBlock("return [", "];", () -> {
            for (MemberShape member : members) {
                writer.write("...memberValidators.$1L.validate($2L.$1L, $3S),",
                        getSanitizedMemberName(member), param, member.getMemberName());
            }
        });
    }

    private void writeValidator(TypeScriptWriter writer, Trait trait) {
        if (trait instanceof RequiredTrait) {
            writer.addImport("RequiredValidator", "__RequiredValidator", "@aws-smithy/server-common");
            writer.write("new __RequiredValidator(),");
        } else if (trait instanceof EnumTrait) {
            writer.addImport("EnumValidator", "__EnumValidator", "@aws-smithy/server-common");
            writer.openBlock("new __EnumValidator([", "]),", () -> {
                for (String e : ((EnumTrait) trait).getEnumDefinitionValues()) {
                    writer.write("$S,", e);
                }
            });
        } else if (trait instanceof LengthTrait) {
            LengthTrait lengthTrait = (LengthTrait) trait;
            writer.addImport("LengthValidator", "__LengthValidator", "@aws-smithy/server-common");
            writer.write("new __LengthValidator($L, $L),",
                    lengthTrait.getMin().map(Object::toString).orElse("undefined"),
                    lengthTrait.getMax().map(Object::toString).orElse("undefined"));
        } else if (trait instanceof PatternTrait) {
            writer.addImport("PatternValidator", "__PatternValidator", "@aws-smithy/server-common");
            writer.write("new __PatternValidator($S),", ((PatternTrait) trait).getValue());
        } else if (trait instanceof RangeTrait) {
            RangeTrait rangeTrait = (RangeTrait) trait;
            writer.addImport("RangeValidator", "__RangeValidator", "@aws-smithy/server-common");
            writer.write("new __RangeValidator($L, $L),",
                    rangeTrait.getMin().map(Object::toString).orElse("undefined"),
                    rangeTrait.getMax().map(Object::toString).orElse("undefined"));
        } else if (trait instanceof UniqueItemsTrait) {
            writer.addImport("UniqueItemsValidator", "__UniqueItemsValidator", "@aws-smithy/server-common");
            writer.write("new __UniqueItemsValidator(),");
        }
    }

    private Collection<Trait> getConstraintTraits(MemberShape member) {
        List<Trait> traits = new ArrayList<>();
        member.getTrait(RequiredTrait.class).ifPresent(traits::add);
        member.getMemberTrait(model, EnumTrait.class).ifPresent(traits::add);
        member.getMemberTrait(model, LengthTrait.class).ifPresent(traits::add);
        member.getMemberTrait(model, PatternTrait.class).ifPresent(traits::add);
        member.getMemberTrait(model, RangeTrait.class).ifPresent(traits::add);
        member.getMemberTrait(model, UniqueItemsTrait.class).ifPresent(traits::add);
        return traits;
    }
}
