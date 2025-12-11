package software.amazon.smithy.typescript.codegen.validation;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class ImportFromTest {

  @Test
  void isNodejsNative() {
    assertTrue(new ImportFrom("node:buffer").isNodejsNative());
    assertTrue(new ImportFrom("stream").isNodejsNative());
    assertFalse(new ImportFrom("@smithy/util").isNodejsNative());
    assertFalse(new ImportFrom("../file").isNodejsNative());
  }

  @Test
  void isNamespaced() {
    assertTrue(new ImportFrom("@smithy/util/submodule").isNamespaced());
    assertTrue(new ImportFrom("@smithy/util").isNamespaced());
    assertFalse(new ImportFrom("node:stream").isNamespaced());
    assertFalse(new ImportFrom("fs/promises").isNamespaced());
  }

  @Test
  void isRelative() {
    assertTrue(new ImportFrom("/file/path").isRelative());
    assertTrue(new ImportFrom("./file/path").isRelative());
    assertTrue(new ImportFrom("../../../../file/path").isRelative());
    assertFalse(new ImportFrom("@smithy/util").isRelative());
    assertFalse(new ImportFrom("fs/promises").isRelative());
  }

  @Test
  void isDeclarablePackageImport() {
    assertTrue(new ImportFrom("@smithy/util/submodule").isDeclarablePackageImport());
    assertTrue(new ImportFrom("@smithy/util").isDeclarablePackageImport());
    assertTrue(new ImportFrom("smithy_pkg").isDeclarablePackageImport());
    assertTrue(new ImportFrom("smithy_pkg/array").isDeclarablePackageImport());
    assertFalse(new ImportFrom("node:buffer").isDeclarablePackageImport());
    assertFalse(new ImportFrom("../pkg/pkg").isDeclarablePackageImport());
  }

  @Test
  void getPackageName() {
    assertEquals(new ImportFrom("smithy_pkg/array").getPackageName(), "smithy_pkg");
    assertEquals(new ImportFrom("@smithy/util/submodule").getPackageName(), "@smithy/util");
    assertEquals(new ImportFrom("node:fs/promises").getPackageName(), "fs");
    assertEquals(new ImportFrom("smithy_pkg").getPackageName(), "smithy_pkg");
  }
}
