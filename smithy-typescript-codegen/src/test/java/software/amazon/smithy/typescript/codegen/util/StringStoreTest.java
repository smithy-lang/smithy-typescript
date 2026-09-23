/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.util;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Objects;
import org.junit.jupiter.api.Test;

class StringStoreTest {

    @Test
    void var() {
        StringStore subject = new StringStore();
        String sourceCode = """
                            const array = [
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s
                            ];
                            """.formatted(
            subject.var("SomeObject"),
            subject.var("some_object"),
            subject.var("SomeObject"),
            subject.var("some_object"),
            subject.var("_"),
            subject.var("__"),
            subject.var("___"),
            subject.var("_internal"),
            subject.var("__internal"),
            subject.var("___internal"),
            subject.var("_internal_"),
            subject.var("__internal__"),
            subject.var("___internal__"),
            subject.var("_two--words"),
            subject.var("__twoWords__"),
            subject.var("___TwoWords__"),
            subject.var("$Symbol"),
            subject.var("%Symbol"),
            subject.var("   !)(@*#&$^%   "),
            subject.var("   !)( @  )(@*#&$^* SmithyTypeScript# &)(@*#&$^  $^%   )(@*#&$^"),
            subject.var("**Ack**Ack**"),
            subject.var("Spaces Are Cool"),
            subject.var("__why Would &&& YouName $something this...")
        );

        String[] expected = """
                            const _ = "_";
                            const _AA = "**Ack**Ack**";
                            const _S = "$Symbol";
                            const _SAC = "Spaces Are Cool";
                            const _SO = "SomeObject";
                            const _S_ = "   !)( @  )(@*#&$^* SmithyTypeScript# &)(@*#&$^  $^%   )(@*#&$^";
                            const _Sy = "%Symbol";
                            const _TW = "___TwoWords__";
                            const __ = "__";
                            const ___ = "___";
                            const ____ = "   !)(@*#&$^%   ";
                            const _i = "_internal";
                            const _in = "__internal";
                            const _int = "___internal";
                            const _inte = "_internal_";
                            const _inter = "__internal__";
                            const _intern = "___internal__";
                            const _so = "some_object";
                            const _tW = "__twoWords__";
                            const _tw = "_two--words";
                            const _wWYt = "__why Would &&& YouName $something this...";

                            const array = [
                                _SO,
                                _so,
                                _SO,
                                _so,
                                _,
                                __,
                                ___,
                                _i,
                                _in,
                                _int,
                                _inte,
                                _inter,
                                _intern,
                                _tw,
                                _tW,
                                _TW,
                                _S,
                                _Sy,
                                ____,
                                _S_,
                                _AA,
                                _SAC,
                                _wWYt
                            ];
                            """.split("\n");
        String[] actual = (subject.flushVariableDeclarationCode() + "\n" + sourceCode).split("\n");

        for (int i = 0; i < expected.length; ++i) {
            assertEquals(
                Objects.toString(i) + ": " + expected[i].trim(),
                Objects.toString(i) + ": " + actual[i].trim()
            );
        }
    }

    @Test
    void escapesSpecialCharacters() {
        // Regression for #2279: model-supplied trait values (e.g. @pattern, @mediaType,
        // @jsonName) containing backslashes, quotes, or control characters must be escaped
        // so the generated TypeScript is valid and the decoded value round-trips.
        StringStore subject = new StringStore();

        // @pattern with an anchored escaped dot: IDL "\\." -> trait value "\." must
        // survive as "\\." in the emitted literal so it decodes back to "\.".
        String patternVar = subject.var("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
        // @mediaType with an embedded double quote.
        String mediaTypeVar = subject.var("text/plain; charset=\"utf-8\"");
        // @jsonName with a backslash.
        String jsonNameVar = subject.var("a\\bc");
        // Control characters.
        String newlineVar = subject.var("line1\nline2");
        String tabVar = subject.var("a\tb");

        String flushed = subject.flushVariableDeclarationCode();

        assertTrue(
            flushed.contains(
                "const " + patternVar
                    + " = \"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$\";"
            ),
            "backslash before dot must be escaped as \\\\.; got:\n" + flushed
        );
        assertTrue(
            flushed.contains("const " + mediaTypeVar + " = \"text/plain; charset=\\\"utf-8\\\"\";"),
            "embedded double quote must be escaped; got:\n" + flushed
        );
        assertTrue(
            flushed.contains("const " + jsonNameVar + " = \"a\\\\bc\";"),
            "backslash must be escaped; got:\n" + flushed
        );
        assertTrue(
            flushed.contains("const " + newlineVar + " = \"line1\\nline2\";"),
            "newline must be escaped; got:\n" + flushed
        );
        assertTrue(
            flushed.contains("const " + tabVar + " = \"a\\tb\";"),
            "tab must be escaped; got:\n" + flushed
        );

        // The value payloads must contain no raw control characters: strip the per-declaration
        // line separator (String.format's %n, which is \r\n on Windows) before checking, so this
        // asserts the escaping of values, not the platform's line terminator.
        String values = flushed.replace(System.lineSeparator(), "");
        assertFalse(values.contains("\n"), "no raw newline in a value; got:\n" + flushed);
        assertFalse(values.contains("\r"), "no raw CR in a value; got:\n" + flushed);
        assertFalse(values.contains("\t"), "no raw tab in a value; got:\n" + flushed);
    }
}
