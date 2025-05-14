package software.amazon.smithy.typescript.codegen.util;

import org.junit.jupiter.api.Test;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.*;

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
        String[] actual = (subject.flushVariableDeclarationCode() + "\n"
            + sourceCode).split("\n");

        for (int i = 0; i < expected.length; ++i) {
            assertEquals(
                Objects.toString(i) + ": " + expected[i].trim(),
                Objects.toString(i) + ": " + actual[i].trim()
            );
        }
    }

    @Test
    void construction() {
        StringStore subject = new StringStore(true);
        subject.var("ListWordsCamelCase");
        subject.var("list-words-hyphenated");
        subject.var("ListWordsCamelCaseButWithTooShortWordOk");
        subject.var("list-words-hyphenated-with-too-short-word-ok");

        subject.var("LongRepeatedPrefixBoolean");
        subject.var("LongRepeatedPrefixBlob");
        subject.var("LongRepeatedPrefixByte");
        subject.var("LongRepeatedPrefixInteger");
        subject.var("LongRepeatedPrefixList");
        subject.var("LongRepeatedPrefixMap");

        assertEquals(
            """
                const _s = "-short";
                const _B = "But";
                const _w = "-with";
                const _Bl = "Blob";
                const _W = "Word";
                const _wo = "-word";
                const _C = "Camel";
                const _P = "Prefix";
                const _R = "Repeated";
                const _l = "list";
                const _Wi = "With";
                const _Ca = "Case";
                const _I = "Integer";
                const _t = "-too";
                const _h = "-hyphenated";
                const _T = "Too";
                const _wor = "-words";
                const _Wo = "Words";
                const _By = "Byte";
                const _L = "Long";
                const _Li = "List";
                const _Bo = "Boolean";
                const _M = "Map";
                const _S = "Short";
                const _c0 = _L+_R+_P;
                
                const _LRPB = _c0+_Bo as "LongRepeatedPrefixBoolean";
                const _LRPBo = _c0+_Bl as "LongRepeatedPrefixBlob";
                const _LRPBon = _c0+_By as "LongRepeatedPrefixByte";
                const _LRPI = _c0+_I as "LongRepeatedPrefixInteger";
                const _LRPL = _c0+_Li as "LongRepeatedPrefixList";
                const _LRPM = _c0+_M as "LongRepeatedPrefixMap";
                const _LWCC = _Li+_Wo+_C+_Ca as "ListWordsCamelCase";
                const _LWCCBWTSWO = _Li+_Wo+_C+_Ca+_B+_Wi+_T+_S+_W + "Ok" as "ListWordsCamelCaseButWithTooShortWordOk";
                const _lwh = _l+_wor+_h as "list-words-hyphenated";
                const _lwhwtswo = _l+_wor+_h+_w+_t+_s+_wo + "-ok" as "list-words-hyphenated-with-too-short-word-ok";
                """,
            subject.flushVariableDeclarationCode()
        );
    }
}