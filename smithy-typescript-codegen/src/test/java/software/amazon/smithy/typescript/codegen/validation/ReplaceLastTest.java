/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.validation;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class ReplaceLastTest {

    @Test
    public void replaceLast() {
        assertEquals(ReplaceLast.in("WorkspacesThinClientClient", "Client", ""), "WorkspacesThinClient");
        assertEquals(ReplaceLast.in("WorkspacesThinClientClientClient", "Client", ""), "WorkspacesThinClientClient");

        assertEquals(ReplaceLast.in("welcometothecity", "e", "is"), "welcometothiscity");
    }
}
