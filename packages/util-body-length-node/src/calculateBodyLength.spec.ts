import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, test as it, vi } from "vitest";

import { calculateBodyLength } from "./calculateBodyLength";

describe(calculateBodyLength.name, () => {
  const arrayBuffer = new ArrayBuffer(1);
  const typedArray = new Uint8Array(1);
  const view = new DataView(arrayBuffer);

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [0, null],
    [0, undefined],
  ])("should return %s for %s", (output, input) => {
    expect(calculateBodyLength(input)).toEqual(output);
  });

  it("should handle string inputs", () => {
    expect(calculateBodyLength("foo")).toEqual(3);
  });

  it("should handle string inputs with multi-byte characters", () => {
    expect(calculateBodyLength("2。")).toEqual(4);
  });

  it("should handle inputs with byteLengths", () => {
    expect(calculateBodyLength(arrayBuffer)).toEqual(1);
  });

  it("should handle TypedArray inputs", () => {
    expect(calculateBodyLength(typedArray)).toEqual(1);
  });

  it("should handle DataView inputs", () => {
    expect(calculateBodyLength(view)).toEqual(1);
  });

  it("should handle a Readable from a file", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "test1-"));
    const filePath = path.join(tmpDir, "foo");
    fs.writeFileSync(filePath, "foo");
    const handle = fs.openSync(filePath, "r");
    const readStream = fs.createReadStream(filePath, { fd: handle });
    expect(calculateBodyLength(readStream)).toEqual(3);
    readStream.destroy();
    fs.unlinkSync(filePath);
    fs.rmdirSync(tmpDir);
  });

  it("should handle Readable with start end from a file", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "test2-"));
    const filePath = path.join(tmpDir, "foo");
    fs.writeFileSync(filePath, "foo");
    const handle = fs.openSync(filePath, "r");
    const readStream = fs.createReadStream(filePath, { fd: handle, start: 1, end: 1 });
    expect(calculateBodyLength(readStream)).toEqual(1);
    readStream.destroy();
    fs.unlinkSync(filePath);
    fs.rmdirSync(tmpDir);
  });

  describe("fs.ReadStream", () => {
    const fileSize = fs.lstatSync(__filename).size;

    describe("should handle stream created using fs.createReadStream", () => {
      it("when path is a string", () => {
        const fsReadStream = fs.createReadStream(__filename);
        expect(calculateBodyLength(fsReadStream)).toEqual(fileSize);
        fsReadStream.close();
      });

      it("when path is a Buffer", () => {
        const fsReadStream = fs.createReadStream(Buffer.from(__filename));
        expect(calculateBodyLength(fsReadStream)).toEqual(fileSize);
        fsReadStream.close();
      });
    });

    it("should handle stream created using fd.createReadStream", async () => {
      const fd = await fs.promises.open(__filename, "r");
      if ((fd as any).createReadStream) {
        const fdReadStream = (fd as any).createReadStream();
        expect(calculateBodyLength(fdReadStream)).toEqual(fileSize);
        fdReadStream.close();
      }
    });
  });

  it.each([true, 1, {}, []])("throws error if Body Length computation fails for: %s", (body) => {
    expect(() => {
      expect(calculateBodyLength(body));
    }).toThrowError(`Body Length computation failed for ${body}`);
  });
});
