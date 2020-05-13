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

    /**
     * Recursively writes filterSensitiveLog for CollectionShape.
     */
    void writeCollectionFilterSensitiveLog(TypeScriptWriter writer, MemberShape collectionMember) {
        Shape memberShape = model.expectShape(collectionMember.getTarget());
        if (memberShape instanceof StructureShape) {
            // Call filterSensitiveLog on Structure.
            writer.write("$T.filterSensitiveLog", symbolProvider.toSymbol(collectionMember));
        } else if (memberShape instanceof CollectionShape) {
            // Iterate over array items, and call array specific function on each member.
            writer.openBlock("item => item.map(", ")",
                () -> {
                    MemberShape nestedCollectionMember = ((CollectionShape) memberShape).getMember();
                    writeCollectionFilterSensitiveLog(writer, nestedCollectionMember);
                }
            );
        } else if (memberShape instanceof MapShape) {
            // Iterate over Object entries, and call reduce to repopulate map.
            writer.openBlock("item => Object.entries(item).reduce(", ")",
                () -> {
                    MemberShape mapMember = ((MapShape) memberShape).getValue();
                    writeMapFilterSensitiveLog(writer, mapMember);
                }
            );
        } else {
            // This path will never reach because of recursive isIterationRequired.
            // Adding it to not break the code, if it does reach in future.
            writer.write("item => item");
        }
    }

    /**
     * Recursively writes filterSensitiveLog for MapShape.
     */
    void writeMapFilterSensitiveLog(TypeScriptWriter writer, MemberShape mapMember) {
        // Reducer is common to all shapes.
        writer.openBlock("(acc: any, [key, value]: [string, $T]) => {", "}, {}",
            symbolProvider.toSymbol(mapMember),
            () -> {
                Shape memberShape = model.expectShape(mapMember.getTarget());
                if (memberShape instanceof StructureShape) {
                    // Call filterSensitiveLog on Structure.
                    writer.write("acc[key] = $T.filterSensitiveLog(value);",
                        symbolProvider.toSymbol(mapMember));
                } else if (memberShape instanceof CollectionShape) {
                    writer.openBlock("acc[key] = value.map(", ")",
                        () -> {
                            MemberShape collectionMember = ((CollectionShape) memberShape).getMember();
                            writeCollectionFilterSensitiveLog(writer, collectionMember);
                        }
                    );
                } else if (memberShape instanceof MapShape) {
                    writer.openBlock("acc[key] = Object.entries(value).reduce(", ")",
                        () -> {
                            MemberShape nestedMapMember = ((MapShape) memberShape).getValue();
                            writeMapFilterSensitiveLog(writer, nestedMapMember);
                        }
                    );
                } else {
                    // This path will never reach because of recursive isIterationRequired.
                    // Adding it to not break the code, if it does reach in future.
                    writer.write("acc[key] = value;");
                }
                writer.write("return acc;");
            }
        );
    }

    void writeFilterSensitiveLog(TypeScriptWriter writer, Shape shape) {
        writer.write("...obj,");
        for (MemberShape member : members) {
            Shape memberShape = model.expectShape(member.getTarget());
            String memberName = TypeScriptUtils.sanitizePropertyName(symbolProvider.toMemberName(member));
            if (member.getMemberTrait(model, SensitiveTrait.class).isPresent()) {
                // member is Sensitive, hide the value.
                writer.write("...(obj.$1L && { $1L: SENSITIVE_STRING }),", memberName);
            } else if (memberShape instanceof StructureShape) {
                // Call filterSensitiveLog on Structure.
                writer.write("...(obj.$1L && { $1L: $2T.filterSensitiveLog(obj.$1L)}),",
                        memberName, symbolProvider.toSymbol(member));
            } else if (memberShape instanceof CollectionShape) {
                MemberShape collectionMember = ((CollectionShape) memberShape).getMember();
                if (isIterationRequired(collectionMember)) {
                    // Iterate over array items, and call array specific function on each member.
                    writer.openBlock("...(obj.$1L && { $1L: obj.$1L.map(", ")}),", memberName,
                        () -> {
                            writeCollectionFilterSensitiveLog(writer, collectionMember);
                        }
                    );
                }
            } else if (memberShape instanceof MapShape) {
                MemberShape mapMember = ((MapShape) memberShape).getValue();
                if (isIterationRequired(mapMember)) {
                    // Iterate over Object entries, and call reduce to repopulate map.
                    writer.openBlock("...(obj.$1L && { $1L: Object.entries(obj.$1L).reduce(", ")}),", memberName,
                        () -> {
                            writeMapFilterSensitiveLog(writer, mapMember);
                        }
                    );
                }
            }
        }
    }

    /**
     * Identifies if iteration is required on MemberShape.
     * 
     * @param memberShape a {@link MemberShape} to check for iteration required.
     * @return Returns true if the iteration is required on memberShape.
     */
    private boolean isIterationRequired(MemberShape memberShape) {
        Shape targetShape = model.expectShape(memberShape.getTarget());
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
