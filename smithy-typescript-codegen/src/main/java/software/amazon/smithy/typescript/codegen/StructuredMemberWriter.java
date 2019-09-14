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
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.utils.StringUtils;

/**
 * Generates objects, interfaces, enums, etc.
 */
final class StructuredMemberWriter {

    Model model;
    SymbolProvider symbolProvider;
    String interfaceName;
    Collection<MemberShape> members;
    String memberPrefix = "";
    boolean isPrivate;
    boolean noDocs;

    StructuredMemberWriter(Model model, SymbolProvider symbolProvider, Symbol symbol, Collection<MemberShape> members) {
        this.model = model;
        this.symbolProvider = symbolProvider;
        this.members = members;
        interfaceName = StringUtils.capitalize(symbol.getName());
    }

    void write(TypeScriptWriter writer, Shape shape) {
        writer.writeShapeDocs(shape);
        String exportPrefix = isPrivate ? "" : "export ";
        writer.openBlock("${L}interface $L {", exportPrefix, interfaceName);
        writeMembers(writer, shape);
        writer.closeBlock("}");
    }

    void writeMembers(TypeScriptWriter writer, Shape shape) {
        int position = -1;
        for (MemberShape member : members) {
            position++;
            boolean wroteDocs = !noDocs && writer.writeMemberDocs(model, member);
            String memberName = TypeScriptUtils.sanitizePropertyName(symbolProvider.toMemberName(member));
            String optionalSuffix = shape.isUnionShape() || !member.isRequired() ? "?" : "";
            String typeSuffix = member.isRequired() ? " | undefined" : "";
            writer.write("${L}${L}${L}: ${T}${L};", memberPrefix, memberName, optionalSuffix,
                         symbolProvider.toSymbol(member), typeSuffix);
            if (wroteDocs && position < members.size() - 1) {
                writer.write("");
            }
        }
    }
}
