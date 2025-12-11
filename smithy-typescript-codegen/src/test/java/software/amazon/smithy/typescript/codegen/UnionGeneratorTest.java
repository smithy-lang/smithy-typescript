package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.MemberShape;
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
}
