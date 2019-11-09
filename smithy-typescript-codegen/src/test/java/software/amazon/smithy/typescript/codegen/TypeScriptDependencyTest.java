package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.Symbol;

public class TypeScriptDependencyTest {
    @Test
    public void createsSymbols() {
        Symbol foo = TypeScriptDependency.AWS_SDK_HASH_NODE.createSymbol("Foo");

        assertThat(foo.getNamespace(), equalTo(TypeScriptDependency.AWS_SDK_HASH_NODE.packageName));
        assertThat(foo.getName(), equalTo("Foo"));
        assertThat(foo.getDependencies(), contains(TypeScriptDependency.AWS_SDK_HASH_NODE.dependency));
    }

    @Test
    public void getsUnconditionalDependencies() {
        assertThat(TypeScriptDependency.getUnconditionalDependencies(),
                   hasItem(TypeScriptDependency.TS_LIB.dependency));
    }
}
