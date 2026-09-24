/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;

public class UnionGeneratorTest {

    @Test
    public void generatesTaggedUnions() {
        MemberShape memberA = MemberShape.builder().id("com.foo#Example$A").target("smithy.api#String").build();
        MemberShape memberB = MemberShape.builder().id("com.foo#Example$B").target("smithy.api#Integer").build();
        MemberShape memberC = MemberShape.builder().id("com.foo#Example$C").target("smithy.api#Boolean").build();
        UnionShape unionShape = UnionShape.builder()
            .id("com.foo#Example")
            .addMember(memberA)
            .addMember(memberB)
            .addMember(memberC)
            .build();
        Model model = Model.assembler()
            .addImport(getClass().getResource("simple-service.smithy"))
            .addShapes(unionShape, memberA, memberB, memberC)
            .assemble()
            .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build()
        );
        SymbolProvider symbolProvider = new SymbolVisitor(model, settings);
        TypeScriptWriter writer = new TypeScriptWriter("./Example");
        new UnionGenerator(model, symbolProvider, writer, unionShape).run();
        String output = writer.toString();

        assertEquals(
            """
            // smithy-typescript generated code
            /**
             * @public
             */
            export type Example =
              | Example.AMember
              | Example.BMember
              | Example.CMember
              | Example.$UnknownMember;

            /**
             * @public
             */
            export namespace Example {
              export interface AMember {
                A: string;
                B?: never;
                C?: never;
                $unknown?: never;
              }

              export interface BMember {
                A?: never;
                B: number;
                C?: never;
                $unknown?: never;
              }

              export interface CMember {
                A?: never;
                B?: never;
                C: boolean;
                $unknown?: never;
              }

              /**
               * @public
               */
              export interface $UnknownMember {
                A?: never;
                B?: never;
                C?: never;
                $unknown: [string, any];
              }

              export interface Visitor<T> {
                A: (value: string) => T;
                B: (value: number) => T;
                C: (value: boolean) => T;
                _: (name: string, value: any) => T;
              }

              export const visit = <T>(value: Example, visitor: Visitor<T>): T => {
                if (value.A !== undefined) return visitor.A(value.A);
                if (value.B !== undefined) return visitor.B(value.B);
                if (value.C !== undefined) return visitor.C(value.C);
                return visitor._(value.$unknown[0], value.$unknown[1]);
              };
            }
            """,
            output
        );
    }

    @Test
    public void deconflictsVariantInterfaceWhenTargetShadowsIt() {
        // Regression for #2280: a member targeting a structure named `<Member>Member`
        // would be shadowed by its own variant interface.
        StructureShape widgetMember = StructureShape.builder()
            .id("com.foo#WidgetMember")
            .addMember(
                MemberShape.builder()
                    .id("com.foo#WidgetMember$widgetId")
                    .target("smithy.api#String")
                    .build()
            )
            .build();
        StructureShape gadget = StructureShape.builder()
            .id("com.foo#Gadget")
            .addMember(
                MemberShape.builder()
                    .id("com.foo#Gadget$gadgetId")
                    .target("smithy.api#String")
                    .build()
            )
            .build();
        MemberShape widget = MemberShape.builder()
            .id("com.foo#Example$widget")
            .target("com.foo#WidgetMember")
            .build();
        MemberShape gadgetMember = MemberShape.builder()
            .id("com.foo#Example$gadget")
            .target("com.foo#Gadget")
            .build();
        UnionShape unionShape = UnionShape.builder()
            .id("com.foo#Example")
            .addMember(widget)
            .addMember(gadgetMember)
            .build();
        Model model = Model.assembler()
            .addImport(getClass().getResource("simple-service.smithy"))
            .addShapes(unionShape, widget, gadgetMember, widgetMember, gadget)
            .assemble()
            .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build()
        );
        SymbolProvider symbolProvider = new SymbolVisitor(model, settings);
        TypeScriptWriter writer = new TypeScriptWriter("./Example");
        new UnionGenerator(model, symbolProvider, writer, unionShape).run();
        String output = writer.toString();

        // The colliding variant is renamed; its field still targets the real structure.
        assertTrue(output.contains("| Example._WidgetMember"), output);
        assertTrue(output.contains("export interface _WidgetMember {"), output);
        assertTrue(output.contains("widget: WidgetMember;"), output);
        // The non-colliding variant is unchanged.
        assertTrue(output.contains("| Example.GadgetMember"), output);
        assertTrue(output.contains("export interface GadgetMember {"), output);
        assertTrue(output.contains("gadget: Gadget;"), output);
        assertTrue(output.contains("widget: (value: WidgetMember) => T;"), output);
        assertTrue(output.contains("gadget: (value: Gadget) => T;"), output);
    }
}
