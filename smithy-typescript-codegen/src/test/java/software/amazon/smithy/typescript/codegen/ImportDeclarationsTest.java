package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.CodegenException;

public class ImportDeclarationsTest {
    @Test
    public void addsSingleNonAliasedImport() {
        ImportDeclarations declarations = new ImportDeclarations("foo/bar");
        declarations.addImport("Big", "", "big.js");
        String result = declarations.toString();

        assertThat(result, containsString("import { Big } from \"big.js\";"));
    }

    @Test
    public void addsSingleAliasedImport() {
        ImportDeclarations declarations = new ImportDeclarations("foo/bar");
        declarations.addImport("Big", "$Big", "big.js");
        String result = declarations.toString();

        assertThat(result, containsString("import { Big as $Big } from \"big.js\";"));
    }

    @Test
    public void addsMultipleImportsOfSameSymbol() {
        ImportDeclarations declarations = new ImportDeclarations("foo/bar");
        declarations.addImport("Big", "Big", "big.js");
        declarations.addImport("Big", "$Big", "big.js");
        String result = declarations.toString();

        assertThat(result, containsString("import { Big, Big as $Big } from \"big.js\";"));
    }

    @Test
    public void relativizesImports() {
        ImportDeclarations declarations = new ImportDeclarations("./foo/bar/index");
        declarations.addImport("Baz", "", "./foo/bar/bam");
        String result = declarations.toString();

        assertThat(result, containsString("import { Baz } from \"./bam\";"));
    }

    @Test
    public void relativizesImportsWithTrailingFilenameOnIndex() {
        ImportDeclarations declarations = new ImportDeclarations("foo/bar/index");
        declarations.addImport("Baz", "", "./shared/shapeTypes");
        String result = declarations.toString();

        assertThat(result, containsString("import { Baz } from \"../../shared/shapeTypes\";"));
    }

    @Test
    public void relativizesImportsWithTrailingFilenameNotIndex() {
        ImportDeclarations declarations = new ImportDeclarations("foo/bar/hello/index");
        declarations.addImport("Baz", "", "./shared/shapeTypes");
        String result = declarations.toString();

        assertThat(result, containsString("import { Baz } from \"../../../shared/shapeTypes\";"));
    }

    @Test
    public void automaticallyCorrectsBasePath() {
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar/index");
        declarations.addImport("Baz", "", "./foo/bar/bam/qux");
        String result = declarations.toString();

        assertThat(result, containsString("import { Baz } from \"./bam/qux\";"));
    }

    @Test
    public void doesNotRelativizeAbsolutePaths() {
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar");
        declarations.addImport("Baz", "", "@types/foo");
        declarations.addImport("Hello", "", "/abc/def");
        String result = declarations.toString();

        assertThat(result, containsString("import { Baz } from \"@types/foo\";"));
        assertThat(result, containsString("import { Hello } from \"/abc/def\";"));
    }

    @Test
    public void canImportFilesUpLevels() {
        ImportDeclarations declarations = new ImportDeclarations("./foo/bar/index");
        declarations.addImport("SharedThing", "", "./shared/types");
        String result = declarations.toString();

        assertThat(result, containsString("import { SharedThing } from \"../../shared/types\";"));
    }

    @Test
    public void throwsOnStarImport() {
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar");
        declarations.addImport("*", "_baz", "@types/foo");
        Assertions.assertThrows(CodegenException.class, () -> declarations.toString());
    }

    @Test
    public void canImportDefaultImport() {
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar");
        declarations.addDefaultImport("foo", "@types/foo");
        String result = declarations.toString();

        assertThat(result, containsString("import foo from \"@types/foo\";"));
    }

    @Test
    public void canImportDefaultImportWithIgnore() {
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar");
        declarations.addIgnoredDefaultImport("foo", "@types/foo", "I want to");
        String result = declarations.toString();

        assertThat(result, containsString("// @ts-ignore: I want to\nimport foo from \"@types/foo\"; // eslint-disable-line"));
    }


    @Test
    public void canImportDefaultImportWithNamedImport() {
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar");
        declarations.addDefaultImport("foo", "@types/foo");
        declarations.addImport("Bar", "Bar", "@types/foo");
        String result = declarations.toString();

        assertThat(result, containsString("import foo from \"@types/foo\";"));
        assertThat(result, containsString("import { Bar } from \"@types/foo\";"));
    }

    @Test
    public void canImportNestedFromRoot() {
        ImportDeclarations declarations = new ImportDeclarations("");
        declarations.addImport("Foo", "", "./models/foo");
        String result = declarations.toString();

        assertThat(result, containsString("import { Foo } from \"./models/foo\";"));
    }

    @Test
    public void canImportNestedFromClient() {
        ImportDeclarations declarations = new ImportDeclarations("./FooClient");
        declarations.addImport("Foo", "", "./models/hello/index");
        String result = declarations.toString();

        assertThat(result, containsString("import { Foo } from \"./models/hello/index\";"));
    }

    @Test
    public void importOrdering() {
        ImportDeclarations declarations = new ImportDeclarations("./FooClient");

        declarations.addTypeImport("ServiceOutputTypes", null, "../RpcV2ProtocolClient");
        declarations.addImport("FractionalSeconds", null, "../schemas/schemas_0");
        declarations.addTypeImport("RpcV2ProtocolClientResolvedConfig", null, "../RpcV2ProtocolClient");
        declarations.addTypeImport("FractionalSecondsOutput", null, "../models/models_0");
        declarations.addImport("commonParams", null, "../endpoint/EndpointParameters");
        declarations.addImport("Command", "$Command", "@smithy/smithy-client");
        declarations.addTypeImport("MetadataBearer", "__MetadataBearer", "@smithy/types");
        declarations.addImport("getEndpointPlugin", null, "@smithy/middleware-endpoint");
        declarations.addTypeImport("ServiceInputTypes", null, "../RpcV2ProtocolClient");

        // https://projects.haykranen.nl/java/
        declarations.addTypeImport(
            "DecoratorContainerSchemaListenerTransactionRepository", null, "../../java8");
        declarations.addTypeImport(
            "AuthenticationExpressionDecoratorContainerSchemaListenerTransactionRepository", null, "../../java11");
        declarations.addTypeImport(
            "ResolverVisitorAuthenticationExpressionDecoratorContainerSchemaListenerTransactions", null, "../../java15");
        // uses multiline format as line width 120 is breached.
        declarations.addTypeImport(
            "ResolverVisitorAuthenticationExpressionDecoratorContainerSchemaListenersTransactions", null, "../../java18");


        String result = declarations.toString();

        assertEquals("""
            import { getEndpointPlugin } from "@smithy/middleware-endpoint";
            import { Command as $Command } from "@smithy/smithy-client";
            import type { MetadataBearer as __MetadataBearer } from "@smithy/types";
            
            import type { AuthenticationExpressionDecoratorContainerSchemaListenerTransactionRepository } from "../../java11";
            import type { ResolverVisitorAuthenticationExpressionDecoratorContainerSchemaListenerTransactions } from "../../java15";
            import type {
              ResolverVisitorAuthenticationExpressionDecoratorContainerSchemaListenersTransactions,
            } from "../../java18";
            import type { DecoratorContainerSchemaListenerTransactionRepository } from "../../java8";
            import { commonParams } from "../endpoint/EndpointParameters";
            import type { FractionalSecondsOutput } from "../models/models_0";
            import type { RpcV2ProtocolClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../RpcV2ProtocolClient";
            import { FractionalSeconds } from "../schemas/schemas_0";

            """,
            result
        );
    }
}
