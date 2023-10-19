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

import java.nio.file.Paths;
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
import software.amazon.smithy.model.shapes.IntEnumShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.SimpleShape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.EnumDefinition;
import software.amazon.smithy.model.traits.EnumTrait;
import software.amazon.smithy.model.traits.EnumValueTrait;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.IdempotencyTokenTrait;
import software.amazon.smithy.model.traits.InternalTrait;
import software.amazon.smithy.model.traits.LengthTrait;
import software.amazon.smithy.model.traits.MediaTypeTrait;
import software.amazon.smithy.model.traits.PatternTrait;
import software.amazon.smithy.model.traits.RangeTrait;
import software.amazon.smithy.model.traits.RequiredTrait;
import software.amazon.smithy.model.traits.SensitiveTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.model.traits.UniqueItemsTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings.RequiredMemberMode;
import software.amazon.smithy.typescript.codegen.validation.SensitiveDataFinder;
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
    RequiredMemberMode requiredMemberMode;
    final Set<String> skipMembers = new HashSet<>();
    private final SensitiveDataFinder sensitiveDataFinder;

    StructuredMemberWriter(Model model, SymbolProvider symbolProvider, Collection<MemberShape> members) {
        this(model, symbolProvider, members, RequiredMemberMode.NULLABLE);
    }

    StructuredMemberWriter(Model model, SymbolProvider symbolProvider, Collection<MemberShape> members,
            RequiredMemberMode requiredMemberMode) {
        this(model, symbolProvider, members, requiredMemberMode, new SensitiveDataFinder(model));
    }

    StructuredMemberWriter(
            Model model,
            SymbolProvider symbolProvider,
            Collection<MemberShape> members,
            RequiredMemberMode requiredMemberMode,
            SensitiveDataFinder sensitiveDataFinder) {
        this.model = model;
        this.symbolProvider = symbolProvider;
        this.members = new LinkedHashSet<>(members);
        this.requiredMemberMode = requiredMemberMode;
        this.sensitiveDataFinder = sensitiveDataFinder;
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
            String typeSuffix = requiredMemberMode == RequiredMemberMode.NULLABLE
                    && isRequiredMember(member) ? " | undefined" : "";
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
                    "MemberFilterSensitiveLog attempted for %s", memberTarget.getType()));
        }
    }

    /**
     * Writes constructor of SDK exception classes.
     */
    void writeErrorConstructor(TypeScriptWriter writer, Shape shape, boolean isServerSdk) {
        ErrorTrait errorTrait = shape.getTrait(ErrorTrait.class).orElseThrow(IllegalStateException::new);
        Symbol symbol = symbolProvider.toSymbol(shape);
        if (!isServerSdk) {
            writer.writeDocs("@internal");
        }
        writer.addImport("ExceptionOptionType", "__ExceptionOptionType",
                TypeScriptDependency.AWS_SMITHY_CLIENT);
        writer.openBlock("constructor(opts: __ExceptionOptionType<$L, __BaseException>) {", symbol.getName());
        writer.openBlock("super({", "});", () -> {
            writer.write("name: $S,", shape.getId().getName());
            writer.write("$$fault: $S,", errorTrait.getValue());
            writer.write("...opts");
        });
        writer.write("Object.setPrototypeOf(this, $L.prototype);", symbol.getName());
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
        writer.addImport("SENSITIVE_STRING", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
        writer.write("SENSITIVE_STRING");
    }

    /**
     * Recursively writes filterSensitiveLog for StructureShape.
     */
    private void writeStructureFilterSensitiveLog(
            TypeScriptWriter writer,
            Shape structureTarget,
            String structureParam) {
        if (structureTarget.hasTrait(SensitiveTrait.class)) {
            writeSensitiveString(writer);
        } else if (structureTarget.hasTrait(StreamingTrait.class) && structureTarget.isUnionShape()) {
            // disable logging for StreamingTrait
            writer.write("'STREAMING_CONTENT'");
        } else if (structureTarget.hasTrait(ErrorTrait.class)) {
            // Sensitive logs are not filtered from errors.
            writer.write("$L", structureParam);
        } else {
            if (sensitiveDataFinder.findsSensitiveDataIn(structureTarget)) {
                // Call filterSensitiveLog on Structure.
                Symbol symbol = symbolProvider.toSymbol(structureTarget);
                String filterFunctionName = symbol.getName() + "FilterSensitiveLog";
                if (!symbol.getNamespace().contains(writer.getModuleName())) {
                    writer.addRelativeImport(filterFunctionName, null, Paths.get(".", symbol.getNamespace()));
                }
                writer.write("$L($L)", filterFunctionName, structureParam);
            } else {
                writer.write("$L", structureParam);
            }
        }
    }

    /**
     * Recursively writes filterSensitiveLog for CollectionShape.
     */
    private void writeCollectionFilterSensitiveLog(
            TypeScriptWriter writer,
            MemberShape collectionMember,
            String collectionParam) {
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
            writer.openBlock("Object.entries($L).reduce(($L: any, [$L, $L]: [string, $T]) => (", "), {})",
                    mapParam, accParam, keyParam, valueParam, symbolProvider.toSymbol(mapMember), () -> {
                        writer.openBlock("$L[$L] =", "", accParam, keyParam, () -> {
                            writeMemberFilterSensitiveLog(writer, mapMember, valueParam);
                            writer.writeInline(",");
                        });
                        writer.write(accParam);
                    });
        }
    }

    /**
     * Identifies if member needs to be overwritten in filterSensitiveLog.
     *
     * @param member  a {@link MemberShape} to check if overwrite is required.
     * @param parents a set of membernames which are parents of existing member to
     *                avoid unending recursion.
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
                for (MemberShape structureMember : structureMemberList) {
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
     * @see <a href=
     *      "https://smithy.io/2.0/spec/behavior-traits.html#idempotencytoken-trait">Smithy
     *      idempotencyToken trait.</a>
     */
    private boolean isRequiredMember(MemberShape member) {
        return member.isRequired() && !member.hasTrait(IdempotencyTokenTrait.class);
    }

    /**
     * Writes an empty cache into the namespace for use by the member validator
     * factory.
     *
     * Due to the fact that validation references can be circular, we need to defer
     * retrieval of validators
     * to runtime, but we do not want to reinstantiate each validator every time it
     * is needed.
     *
     * @param writer    the writer for the type, currently positioned in the type's
     *                  exported namespace
     * @param cacheName the name of the in-scope cache for the validators
     */
    void writeMemberValidatorCache(TypeScriptWriter writer, String cacheName) {
        writer.openBlock("const $L : {", "} = {};", cacheName, () -> {
            for (MemberShape member : members) {
                writer.addImport("MultiConstraintValidator",
                        "__MultiConstraintValidator",
                        TypeScriptDependency.SERVER_COMMON);
                final Shape targetShape = model.expectShape(member.getTarget());
                writer.writeInline("$L?: ", getSanitizedMemberName(member));
                writer.writeInline("__MultiConstraintValidator<");
                writeConstraintValidatorType(writer, targetShape);
                writer.write(">,");
            }
        });
    }

    /**
     * Writes a member validator factory method that will reuse cached validators,
     * or create new ones if this is
     * the first instance of validation.
     *
     * @param writer    the writer for the type, currently positioned in the type's
     *                  validate method
     * @param cacheName the name of the in-scope cache for the validators
     */
    void writeMemberValidatorFactory(TypeScriptWriter writer, String cacheName) {
        writer.openBlock("function getMemberValidator<T extends keyof typeof $1L>(member: T): "
                + "NonNullable<typeof $1L[T]> {",
                "}",
                cacheName,
                () -> {
                    writer.openBlock("if ($L[member] === undefined) {", "}", cacheName, () -> {
                        writer.openBlock("switch (member) {", "}", () -> {
                            for (MemberShape member : members) {
                                final Shape targetShape = model.expectShape(member.getTarget());
                                Collection<Trait> constraintTraits = getConstraintTraits(member);
                                writer.openBlock("case $S: {", "}", getSanitizedMemberName(member), () -> {
                                    writer.writeInline("$L[$S] = ", cacheName, getSanitizedMemberName(member));
                                    if (member.getMemberTrait(model, SensitiveTrait.class).isPresent()) {
                                        writeSensitiveWrappedMemberValidator(writer, targetShape, constraintTraits);
                                    } else {
                                        writeMemberValidator(writer, targetShape, constraintTraits, ";");
                                    }
                                    writer.write("break;");
                                });
                            }
                        });
                    });
                    writer.write("return $L[member]!!;", cacheName);
                });
    }

    /**
     * Writes the validate method contents.
     *
     * @param writer the writer, positioned within the validate method
     * @param param  the parameter name of the object being validated
     */
    void writeValidateMethodContents(TypeScriptWriter writer, String param) {
        writer.openBlock("return [", "];", () -> {
            for (MemberShape member : members) {
                String optionalSuffix = "";
                if (member.getMemberTrait(model, MediaTypeTrait.class).isPresent()
                        && model.expectShape(member.getTarget()) instanceof StringShape) {
                    // lazy JSON wrapper validation should be done based on the serialized form of
                    // the object
                    optionalSuffix = "?.toString()";
                }
                writer.write("...getMemberValidator($1S).validate($2L.$1L$4L, `$${path}/$3L`),",
                        getSanitizedMemberName(member), param, member.getMemberName(), optionalSuffix);
            }
        });
    }

    /**
     * Writes a SensitiveConstraintValidator enclosing the shape validator for a
     * sensitive member.
     */
    private void writeSensitiveWrappedMemberValidator(TypeScriptWriter writer,
            Shape targetShape,
            Collection<Trait> constraintTraits) {
        writer.addImport("SensitiveConstraintValidator",
                "__SensitiveConstraintValidator",
                TypeScriptDependency.SERVER_COMMON);
        writer.writeInline("new __SensitiveConstraintValidator<");
        writeConstraintValidatorType(writer, targetShape);
        writer.openBlock(">(", ");",
                () -> writeMemberValidator(writer, targetShape, constraintTraits, ""));
    }

    /**
     * Writes the validator for the member of a structure or union.
     *
     * @param writer           the writer
     * @param shape            the shape targeted by the member
     * @param constraintTraits the traits applied to the targeted shape and the
     *                         member
     * @param trailer          what to append to the output (such as a comma or
     *                         semicolon)
     */
    private void writeMemberValidator(TypeScriptWriter writer,
            Shape shape,
            Collection<Trait> constraintTraits,
            String trailer) {
        if (shape instanceof SimpleShape) {
            writeShapeValidator(writer, shape, constraintTraits, trailer);
            return;
        }

        if (shape.isStructureShape() || shape.isUnionShape()) {
            writer.addImport("CompositeStructureValidator",
                    "__CompositeStructureValidator",
                    TypeScriptDependency.SERVER_COMMON);
            writer.openBlock("new __CompositeStructureValidator<$T>(", ")" + trailer,
                    getValidatorValueType(shape),
                    () -> {
                        writeShapeValidator(writer, shape, constraintTraits, ",");
                        writer.write("$T.validate", symbolProvider.toSymbol(shape));
                    });
        } else if (shape.isListShape() || shape.isSetShape()) {
            writer.addImport("CompositeCollectionValidator",
                    "__CompositeCollectionValidator",
                    TypeScriptDependency.SERVER_COMMON);
            MemberShape collectionMemberShape = ((CollectionShape) shape).getMember();
            Shape collectionMemberTargetShape = model.expectShape(collectionMemberShape.getTarget());
            writer.openBlock("new __CompositeCollectionValidator<$T>(", ")" + trailer,
                    getValidatorValueType(shape),
                    () -> {
                        writeShapeValidator(writer, shape, constraintTraits, ",");
                        writeMemberValidator(writer,
                                collectionMemberTargetShape,
                                getConstraintTraits(collectionMemberShape),
                                "");
                    });
        } else if (shape.isMapShape()) {
            writer.addImport("CompositeMapValidator", "__CompositeMapValidator", TypeScriptDependency.SERVER_COMMON);

            MapShape mapShape = (MapShape) shape;
            final MemberShape keyShape = mapShape.getKey();
            final MemberShape valueShape = mapShape.getValue();
            writer.openBlock("new __CompositeMapValidator<$T>(", ")" + trailer,
                    getValidatorValueType(shape),
                    () -> {
                        writeShapeValidator(writer, mapShape, constraintTraits, ",");
                        writeMemberValidator(writer,
                                model.expectShape(keyShape.getTarget()),
                                getConstraintTraits(keyShape),
                                ",");
                        writeMemberValidator(writer,
                                model.expectShape(valueShape.getTarget()),
                                getConstraintTraits(valueShape),
                                "");
                    });
        } else {
            throw new IllegalArgumentException(
                    String.format("Unsupported shape found when generating validator: %s", shape));
        }
    }

    /**
     * Writes a validator for a shape, aggregating all of the constraints applied to
     * it. This shape could be a member
     * target, or the target of a shape (such as the member of a list or the value
     * of a map).
     *
     * @param writer      the writer
     * @param shape       the shape being validated
     * @param constraints the constraints relevant to this shape (includes member
     *                    traits for member targets)
     * @param trailer     what to append to the output (for instance, a comma or
     *                    semicolon)
     */
    private void writeShapeValidator(TypeScriptWriter writer,
            Shape shape,
            Collection<Trait> constraints,
            String trailer) {
        boolean shouldWriteIntEnumValidator = shape.isIntEnumShape();

        if (constraints.isEmpty() && !shouldWriteIntEnumValidator) {
            writer.addImport("NoOpValidator", "__NoOpValidator", TypeScriptDependency.SERVER_COMMON);
            writer.write("new __NoOpValidator()" + trailer);
            return;
        }

        writer.addImport("CompositeValidator", "__CompositeValidator", TypeScriptDependency.SERVER_COMMON);
        writer.openBlock("new __CompositeValidator<$T>([", "])" + trailer, getSymbolForValidatedType(shape),
                () -> {
                    if (shouldWriteIntEnumValidator) {
                        writer.addImport("IntegerEnumValidator", "__IntegerEnumValidator",
                            TypeScriptDependency.SERVER_COMMON);
                        writer.openBlock("new __IntegerEnumValidator([", "]),", () -> {
                            for (int i : ((IntEnumShape) shape).getEnumValues().values()) {
                                writer.write("$L,", i);
                            }
                        });
                    }

                    if (shape.isEnumShape()) {
                        writer.addImport("EnumValidator", "__EnumValidator", TypeScriptDependency.SERVER_COMMON);
                        Collection<MemberShape> enumValues = shape.asEnumShape().get().getAllMembers().values();
                        writer.openBlock("new __EnumValidator([", "]),", () -> {
                            for (MemberShape member : enumValues) {
                                writer.write("$S,", member.expectTrait(EnumValueTrait.class).expectStringValue());
                            }
                            writer.write("], [");
                            for (MemberShape member : shape.asEnumShape().get().getAllMembers().values()) {
                                if (!member.hasTrait((InternalTrait.class))) {
                                    writer.write("$S,", member.expectTrait(EnumValueTrait.class).expectStringValue());
                                }
                            }
                        });
                    }

                    for (Trait t : constraints) {
                        writeSingleConstraintValidator(writer, t);
                    }
                });
    }

    /**
     * Writes a validator for one constraint of one member.
     */
    private void writeSingleConstraintValidator(TypeScriptWriter writer, Trait trait) {
        if (trait instanceof RequiredTrait) {
            writer.addImport("RequiredValidator", "__RequiredValidator", TypeScriptDependency.SERVER_COMMON);
            writer.write("new __RequiredValidator(),");
        } else if (trait instanceof EnumTrait && !trait.isSynthetic()) {
            writer.addImport("EnumValidator", "__EnumValidator", TypeScriptDependency.SERVER_COMMON);
            writer.openBlock("new __EnumValidator([", "]),", () -> {
                for (String e : ((EnumTrait) trait).getEnumDefinitionValues()) {
                    writer.write("$S,", e);
                }
                writer.write("], [");
                for (EnumDefinition enumDefinition : ((EnumTrait) trait).getValues()) {
                    if (!enumDefinition.hasTag("internal")) {
                        writer.write("$S, ", enumDefinition.getValue());
                    }
                }
            });
        } else if (trait instanceof LengthTrait) {
            LengthTrait lengthTrait = (LengthTrait) trait;
            writer.addImport("LengthValidator", "__LengthValidator", TypeScriptDependency.SERVER_COMMON);
            writer.write("new __LengthValidator($L, $L),",
                    lengthTrait.getMin().map(Object::toString).orElse("undefined"),
                    lengthTrait.getMax().map(Object::toString).orElse("undefined"));
        } else if (trait instanceof PatternTrait) {
            writer.addImport("PatternValidator", "__PatternValidator", TypeScriptDependency.SERVER_COMMON);
            writer.write("new __PatternValidator($S),", ((PatternTrait) trait).getValue());
        } else if (trait instanceof RangeTrait) {
            RangeTrait rangeTrait = (RangeTrait) trait;
            writer.addImport("RangeValidator", "__RangeValidator", TypeScriptDependency.SERVER_COMMON);
            writer.write("new __RangeValidator($L, $L),",
                    rangeTrait.getMin().map(Object::toString).orElse("undefined"),
                    rangeTrait.getMax().map(Object::toString).orElse("undefined"));
        } else if (trait instanceof UniqueItemsTrait) {
            writer.addImport("UniqueItemsValidator", "__UniqueItemsValidator", TypeScriptDependency.SERVER_COMMON);
            writer.write("new __UniqueItemsValidator(),");
        }
    }

    /**
     * Writes the type that is being validated (the TS type corresponding to the
     * target shape) that is used as a
     * type arg for MultiConstraintValidator.
     */
    private void writeConstraintValidatorType(TypeScriptWriter writer, Shape shape) {
        if (shape.isStructureShape() || shape.isUnionShape()) {
            writer.writeInline("$T", symbolProvider.toSymbol(shape));
        } else if (shape.isListShape() || shape.isSetShape()) {
            MemberShape collectionMemberShape = ((CollectionShape) shape).getMember();
            Shape collectionMemberTargetShape = model.expectShape(collectionMemberShape.getTarget());
            writer.writeInline("Iterable<$T>", getSymbolForValidatedType(collectionMemberTargetShape));
        } else if (shape.isMapShape()) {
            MapShape mapShape = shape.asMapShape().get();
            String keyType = getSymbolForValidatedType(mapShape.getKey()).toString();

            if (keyType.equals("string")) {
                writer.writeInline("Record<$T, $T>",
                    getSymbolForValidatedType(mapShape.getKey()),
                    getSymbolForValidatedType(mapShape.getValue())
                );
            } else {
                writer.writeInline("Partial<Record<$T, $T>>",
                    getSymbolForValidatedType(mapShape.getKey()),
                    getSymbolForValidatedType(mapShape.getValue())
                );
            }
        } else if (shape instanceof SimpleShape) {
            writer.writeInline("$T", getSymbolForValidatedType(shape));
        } else {
            throw new IllegalArgumentException(
                    String.format("Unsupported shape found when generating validator: %s", shape));
        }
    }

    /**
     * @return returns the value type for a validator. For maps, this is the type of
     *         the value; for lists, this is
     *         the member type. This type is loosened by
     *         {@link #getSymbolForValidatedType(Shape)}
     */
    private Symbol getValidatorValueType(Shape shape) {
        if (shape.isStructureShape() || shape.isUnionShape()) {
            return symbolProvider.toSymbol(shape);
        } else if (shape.isListShape() || shape.isSetShape()) {
            MemberShape collectionMemberShape = ((CollectionShape) shape).getMember();
            Shape collectionMemberTargetShape = model.expectShape(collectionMemberShape.getTarget());
            return getSymbolForValidatedType(collectionMemberTargetShape);
        } else if (shape.isMapShape()) {
            return getSymbolForValidatedType(((MapShape) shape).getValue());
        } else if (shape instanceof SimpleShape) {
            return getSymbolForValidatedType(shape);
        } else {
            throw new IllegalArgumentException(
                    String.format("Unsupported shape found when generating validator: %s", shape));
        }
    }

    /**
     * If we return the direct symbol for the validated type, then TypeScript will
     * not pass type checks when we pass
     * raw deserialized values into our validators. This is particularly problematic
     * for enums.
     *
     * @return a looser supertype of the modeled value type (generally, string
     *         instead of a subtype of string)
     */
    private Symbol getSymbolForValidatedType(Shape shape) {
        if (shape instanceof StringShape) {
            return symbolProvider.toSymbol(model.expectShape(ShapeId.from("smithy.api#String")));
        } else if (shape instanceof IntEnumShape) {
            return symbolProvider.toSymbol(model.expectShape(ShapeId.from("smithy.api#Integer")));
        }

        // Streaming blob inputs can also take string, Uint8Array and Buffer, so we
        // widen the symbol
        if (shape.isBlobShape() && shape.hasTrait(StreamingTrait.class)) {
            return symbolProvider.toSymbol(shape)
                    .toBuilder()
                    .addReference(Symbol.builder()
                        .name("Readable").namespace("stream", "/")
                        .build())
                    .name("Readable | ReadableStream | Blob | string | Uint8Array | Buffer")
                    .build();
        }

        return symbolProvider.toSymbol(shape);
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
