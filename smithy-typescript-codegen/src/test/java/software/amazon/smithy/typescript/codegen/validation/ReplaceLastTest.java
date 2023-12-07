package software.amazon.smithy.typescript.codegen.validation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ReplaceLastTest {

    @Test
    public void replaceLast() {
        assertEquals(ReplaceLast.in("WorkspacesThinClientClient", "Client", ""), "WorkspacesThinClient");
        assertEquals(ReplaceLast.in("WorkspacesThinClientClientClient", "Client", ""), "WorkspacesThinClientClient");

        assertEquals(ReplaceLast.in("welcometothecity", "e", "is"), "welcometothiscity");
    }
}