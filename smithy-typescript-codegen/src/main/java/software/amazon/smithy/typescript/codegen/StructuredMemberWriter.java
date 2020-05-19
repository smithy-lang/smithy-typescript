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

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.IdempotencyTokenTrait;
import software.amazon.smithy.model.traits.SensitiveTrait;

/**
 * Generates objects, interfaces, enums, etc.
 *
 * TODO: Replace this with a builder for generating classes and interfaces.
 */
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
        this.members = members;
    }

    void writeMembers(TypeScriptWriter writer, Shape shape) {
        int position = -1;
        for (MemberShape member : members) {
            if (skipMembers.contains(member.getMemberName())) {
                continue;
            }

            position++;
            boolean wroteDocs = !noDocs && writer.writeMemberDocs(model, member);
            String memberName = TypeScriptUtils.sanitizePropertyName(symbolProvider.toMemberName(member));
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
            if (isMemberOverwriteRequired(member)) {
                Shape memberShape = model.expectShape(member.getTarget());
                String memberName = TypeScriptUtils.sanitizePropertyName(symbolProvider.toMemberName(member));
                String memberParam = String.format("%s.%s", objectParam, memberName);
                writer.openBlock("...($1L.$2L && { $2L: ", "}),", objectParam, memberName, () -> {
                    if (member.getMemberTrait(model, SensitiveTrait.class).isPresent()) {
                        // member is Sensitive, hide the value.
                        writer.write("SENSITIVE_STRING");
                    } else if (memberShape instanceof StructureShape) {
                        writeStructureFilterSensitiveLog(writer, memberShape, memberParam);
                    } else if (memberShape instanceof CollectionShape) {
                        MemberShape collectionMember = ((CollectionShape) memberShape).getMember();
                        writeCollectionFilterSensitiveLog(writer, collectionMember, memberParam);
                    } else if (memberShape instanceof MapShape) {
                        MemberShape mapMember = ((MapShape) memberShape).getValue();
                        writeMapFilterSensitiveLog(writer, mapMember, memberParam);
                    }
                });
            }
        }
    }

    /**
     * Recursively writes filterSensitiveLog for StructureShape.
     */
    private void writeStructureFilterSensitiveLog(TypeScriptWriter writer, Shape structureShape, String structureParam) {
        if (structureShape.getMemberTrait(model, SensitiveTrait.class).isPresent()) {
            // member is Sensitive, hide the value.
            writer.write("SENSITIVE_STRING");
            return;
        }
        // Call filterSensitiveLog on Structure.
        writer.openBlock("$T.filterSensitiveLog($L)", symbolProvider.toSymbol(structureShape), structureParam);
    }

    /**
     * Recursively writes filterSensitiveLog for CollectionShape.
     */
    private void writeCollectionFilterSensitiveLog(TypeScriptWriter writer, MemberShape collectionMember, String collectionParam) {
        if (collectionMember.getMemberTrait(model, SensitiveTrait.class).isPresent()) {
            // member is Sensitive, hide the value.
            writer.write("SENSITIVE_STRING");
            return;
        }

        writer.openBlock("$L.map(", ")", collectionParam, () -> {
            String itemParam = "item";
            Shape memberShape = model.expectShape(collectionMember.getTarget());
            writer.write("$L => ", itemParam);
            if (memberShape instanceof StructureShape) {
                writeStructureFilterSensitiveLog(writer, memberShape, itemParam);
            } else if (memberShape instanceof CollectionShape) {
                MemberShape nestedCollectionMember = ((CollectionShape) memberShape).getMember();
                writeCollectionFilterSensitiveLog(writer, nestedCollectionMember, itemParam);
            } else if (memberShape instanceof MapShape) {
                MemberShape mapMember = ((MapShape) memberShape).getValue();
                writeMapFilterSensitiveLog(writer, mapMember, itemParam);
            } else {
                // This path should not reach because of recursive isIterationRequired.
                throw new CodegenException(String.format(
                    "CollectionFilterSensitiveLog attempted for %s while it was not required",
                    memberShape.getType()
                ));
                // For quick-fix in case of high severity issue:
                // comment out the exception above and uncomment the line below.
                // writer.write("$1L => $1L", itemParam);
            }
        });
    }

    /**
     * Recursively writes filterSensitiveLog for MapShape.
     */
    private void writeMapFilterSensitiveLog(TypeScriptWriter writer, MemberShape mapMember, String mapParam) {
        if (mapMember.getMemberTrait(model, SensitiveTrait.class).isPresent()) {
            // member is Sensitive, hide the value.
            writer.write("SENSITIVE_STRING");
            return;
        }

        String accParam = "acc"; // accumulator for the reducer
        String keyParam = "key"; // key of the Object.entries() key-value pair
        String valueParam = "value"; // value of the Object.entries() key-value pair

        // Reducer is common to all shapes.
        writer.openBlock("Object.entries($L).reduce(($L: any, [$L, $L]: [string, $T]) => ({", "}), {})",
            mapParam, accParam, keyParam, valueParam, symbolProvider.toSymbol(mapMember), () -> {
                writer.write("...$L,", accParam);
                Shape memberShape = model.expectShape(mapMember.getTarget());
                writer.openBlock("[$L]: ",",", keyParam, () -> {
                    if (memberShape instanceof StructureShape) {
                        writeStructureFilterSensitiveLog(writer, memberShape, valueParam);
                    } else if (memberShape instanceof CollectionShape) {
                        MemberShape collectionMember = ((CollectionShape) memberShape).getMember();
                        writeCollectionFilterSensitiveLog(writer, collectionMember, valueParam);
                    } else if (memberShape instanceof MapShape) {
                        MemberShape nestedMapMember = ((MapShape) memberShape).getValue();
                        writeMapFilterSensitiveLog(writer, nestedMapMember, valueParam);
                    } else {
                        // This path should not reach because of recursive isIterationRequired.
                        throw new CodegenException(String.format(
                            "MapFilterSensitiveLog attempted for %s while it was not required",
                            memberShape.getType()
                        ));
                        // For quick-fix in case of high severity issue:
                        // comment out the exception above and uncomment the line below.
                        // writer.write("$L", valueParam);
                    }

                });
            }
        );
    }

    /**
     * Identifies if iteration is required on member.
     * 
     * @param member a {@link MemberShape} to check for iteration required.
     * @return Returns true if the iteration is required on member.
     */
    private boolean isIterationRequired(MemberShape member) {
        Shape targetShape = model.expectShape(member.getTarget());
        if (targetShape instanceof StructureShape) {
            return true;
        } if (targetShape instanceof CollectionShape) {
            MemberShape collectionMember = ((CollectionShape) targetShape).getMember();
            return isIterationRequired(collectionMember);
        } else if (targetShape instanceof MapShape) {
            MemberShape mapMember = ((MapShape) targetShape).getValue();
            return isIterationRequired(mapMember);
        }
        return false;
    }

    /**
     * Identifies if member needs to be overwritten in filterSensitiveLog.
     * 
     * @param member a {@link MemberShape} to check if overwrite is required.
     * @return Returns true if the overwrite is required on member.
     */
    private boolean isMemberOverwriteRequired(MemberShape member) {
        return (
            member.getMemberTrait(model, SensitiveTrait.class).isPresent() || isIterationRequired(member)
        );
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
}
