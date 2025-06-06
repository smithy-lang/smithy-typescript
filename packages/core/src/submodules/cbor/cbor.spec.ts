import { NumericValue } from "@smithy/core/serde";
import * as fs from "fs";
// @ts-ignore
import JSONbig from "json-bigint";
import * as path from "path";
import { describe, expect, test as it } from "vitest";

import { cbor } from "./cbor";
import { bytesToFloat16 } from "./cbor-decode";
import { tagSymbol } from "./cbor-types";
import { dateToTag } from "./parseCborBody";

// syntax is ESM but the test target is CJS.
const here = __dirname;

const errorTests = JSONbig({ useNativeBigInt: true, alwaysParseAsBig: false }).parse(
  fs.readFileSync(path.join(here, "test-data", "decode-error-tests.json"))
);
const successTests = JSONbig({ useNativeBigInt: true, alwaysParseAsBig: false }).parse(
  fs.readFileSync(path.join(here, "test-data", "success-tests.json"))
);

describe("cbor", () => {
  const allocByteArray = (dataOrSize: ArrayBuffer | ArrayLike<number> | number, offset?: number, length?: number) => {
    if (typeof offset === "number" && typeof length === "number") {
      return typeof Buffer !== "undefined"
        ? Buffer.from(dataOrSize as ArrayBuffer, offset, length)
        : new Uint8Array(dataOrSize as ArrayBuffer, offset, length);
    }
    return typeof Buffer !== "undefined" ? Buffer.from(dataOrSize as any) : new Uint8Array(dataOrSize as any);
  };

  const examples = [
    {
      name: "false",
      data: false,
      // special major 7 = 0b111 plus false(20) = 0b10100
      cbor: allocByteArray([0b111_10100]),
    },
    {
      name: "true",
      data: true,
      // increment from false
      cbor: allocByteArray([0b111_10101]),
    },
    {
      name: "null",
      data: null,
      // increment from true
      cbor: allocByteArray([0b111_10110]),
    },
    {
      name: "an unsigned zero integer",
      data: 0,
      // unsigned int major (0) plus 00's.
      cbor: allocByteArray([0b000_00000]),
    },
    {
      name: "negative 1",
      data: -1,
      // negative major (1) plus 00's, since -1 is the first negative number.
      cbor: allocByteArray([0b001_00000]),
    },
    {
      name: "a tricky float",
      data: [7.624000072479248, 7.624],
      cbor: allocByteArray([130, 251, 64, 30, 126, 249, 224, 0, 0, 0, 251, 64, 30, 126, 249, 219, 34, 208, 229]),
    },
    {
      name: "Number.MIN_SAFE_INTEGER",
      data: -9007199254740991,
      cbor: allocByteArray([0b001_11011, 0, 31, 255, 255, 255, 255, 255, 254]),
    },
    {
      name: "Number.MAX_SAFE_INTEGER",
      data: 9007199254740991,
      cbor: allocByteArray([0b000_11011, 0, 31, 255, 255, 255, 255, 255, 255]),
    },
    {
      name: "int64 min",
      data: BigInt("-18446744073709551616"),
      cbor: allocByteArray([0b001_11011, 255, 255, 255, 255, 255, 255, 255, 255]),
    },
    {
      name: "int64 max",
      data: BigInt("18446744073709551615"),
      cbor: allocByteArray([0b000_11011, 255, 255, 255, 255, 255, 255, 255, 255]),
    },
    {
      name: "negative float",
      data: -3015135.135135135,
      cbor: allocByteArray([0b111_11011, 193, 71, 0, 239, 145, 76, 27, 173]),
    },
    {
      name: "positive float",
      data: 3015135.135135135,
      cbor: allocByteArray([0b111_11011, 65, 71, 0, 239, 145, 76, 27, 173]),
    },
    {
      name: "various numbers",
      data: [
        BigInt("18446744073709551615"),
        4294967295,
        65535,
        257,
        256,
        255,
        254,
        129,
        128,
        127,
        65,
        64,
        63,
        33,
        32,
        31,
        17,
        16,
        15,
        9,
        8,
        7,
        5,
        4,
        3,
        2,
        1,
        0,
        -1,
        -2,
        -3,
        -4,
        -5,
        -7,
        -8,
        -9,
        -15,
        -16,
        -17,
        -31,
        -32,
        -33,
        -63,
        -64,
        -65,
        -127,
        -128,
        -129,
        -254,
        -255,
        -256,
        -257,
        -65535,
        -4294967295,
        -BigInt("18446744073709551616"),
      ],
      cbor: allocByteArray([
        152, 55, 27, 255, 255, 255, 255, 255, 255, 255, 255, 26, 255, 255, 255, 255, 25, 255, 255, 25, 1, 1, 25, 1, 0,
        24, 255, 24, 254, 24, 129, 24, 128, 24, 127, 24, 65, 24, 64, 24, 63, 24, 33, 24, 32, 24, 31, 17, 16, 15, 9, 8,
        7, 5, 4, 3, 2, 1, 0, 32, 33, 34, 35, 36, 38, 39, 40, 46, 47, 48, 56, 30, 56, 31, 56, 32, 56, 62, 56, 63, 56, 64,
        56, 126, 56, 127, 56, 128, 56, 253, 56, 254, 56, 255, 57, 1, 0, 57, 255, 254, 58, 255, 255, 255, 254, 59, 255,
        255, 255, 255, 255, 255, 255, 255,
      ]),
    },
    {
      name: "an empty string",
      data: "",
      // string major plus 00's
      cbor: allocByteArray([0b011_00000]),
    },
    {
      name: "a short string",
      data: "hello, world",
      cbor: allocByteArray([108, 104, 101, 108, 108, 111, 44, 32, 119, 111, 114, 108, 100]),
    },
    {
      name: "simple object",
      data: {
        message: "hello, world",
      },
      cbor: allocByteArray([
        161, 103, 109, 101, 115, 115, 97, 103, 101, 108, 104, 101, 108, 108, 111, 44, 32, 119, 111, 114, 108, 100,
      ]),
    },
    {
      name: "date=0",
      data: dateToTag(new Date(0)),
      // major tag (6 or 110), minor 1 (timestamp)
      cbor: allocByteArray([0b11000001, 0]),
    },
    {
      name: "date=turn of the millenium",
      data: dateToTag(new Date(946684799999)),
      // major tag (6 or 110), minor 1 (timestamp)
      cbor: allocByteArray([0b11000001, 251, 65, 204, 54, 161, 191, 255, 223, 59]),
    },
    {
      name: "complex object",
      data: {
        number: 135019305913059,
        message: "hello, world",
        list: [0, false, { a: "b" }],
        map: {
          a: "a",
          b: "b",
          items: [0, -1, true, false, null, "", "test", ["nested item A", "nested item B"]],
        },
      },
      cbor: allocByteArray([
        164, 102, 110, 117, 109, 98, 101, 114, 27, 0, 0, 122, 204, 161, 196, 74, 227, 103, 109, 101, 115, 115, 97, 103,
        101, 108, 104, 101, 108, 108, 111, 44, 32, 119, 111, 114, 108, 100, 100, 108, 105, 115, 116, 131, 0, 244, 161,
        97, 97, 97, 98, 99, 109, 97, 112, 163, 97, 97, 97, 97, 97, 98, 97, 98, 101, 105, 116, 101, 109, 115, 136, 0, 32,
        245, 244, 246, 96, 100, 116, 101, 115, 116, 130, 109, 110, 101, 115, 116, 101, 100, 32, 105, 116, 101, 109, 32,
        65, 109, 110, 101, 115, 116, 101, 100, 32, 105, 116, 101, 109, 32, 66,
      ]),
    },
    {
      name: "object containing big numbers",
      data: {
        map: {
          items: [BigInt(1e80)],
        },
      },
      cbor: allocByteArray([
        161, 99, 109, 97, 112, 161, 101, 105, 116, 101, 109, 115, 129, 194, 88, 34, 3, 95, 157, 234, 62, 31, 107, 224,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ]),
    },
  ];

  const toBytes = (hex: string) => {
    const bytes = [] as number[];
    hex.replace(/../g, (substr: string): string => {
      bytes.push(parseInt(substr, 16));
      return substr;
    });
    return allocByteArray(bytes);
  };

  describe("locally curated scenarios", () => {
    it("should round-trip bigInteger to major 6 with tag 2", () => {
      const bigInt = BigInt("1267650600228229401496703205376");
      const serialized = cbor.serialize(bigInt);

      const major = serialized[0] >> 5;
      expect(major).toEqual(0b110); // 6

      const tag = serialized[0] & 0b11111;
      expect(tag).toEqual(0b010); // 2

      const byteStringCount = serialized[1];
      expect(byteStringCount).toEqual(0b010_01101); // major 2, 13 bytes

      const byteString = serialized.slice(2);
      expect(byteString).toEqual(allocByteArray([0b000_10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));

      const deserialized = cbor.deserialize(serialized);
      expect(deserialized).toEqual(bigInt);
    });

    it("should round-trip negative bigInteger to major 6 with tag 3", () => {
      const bigInt = BigInt("-1267650600228229401496703205377");
      const serialized = cbor.serialize(bigInt);

      const major = serialized[0] >> 5;
      expect(major).toEqual(0b110); // 6

      const tag = serialized[0] & 0b11111;
      expect(tag).toEqual(0b011); // 3

      const byteStringCount = serialized[1];
      expect(byteStringCount).toEqual(0b010_01101); // major 2, 13 bytes

      const byteString = serialized.slice(2);
      expect(byteString).toEqual(allocByteArray([0b000_10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));

      const deserialized = cbor.deserialize(serialized);
      expect(deserialized).toEqual(bigInt);
    });

    it("should round-trip NumericValue to major 6 with tag 4", () => {
      for (const bigDecimal of [
        "10000000000000000000000054.321",
        "1000000000000000000000000000000000054.134134321",
        "100000000000000000000000000000000000054.0000000000000001",
        "100000000000000000000000000000000000054.00510351095130000",
        "-10000000000000000000000054.321",
        "-1000000000000000000000000000000000054.134134321",
        "-100000000000000000000000000000000000054.0000000000000001",
        "-100000000000000000000000000000000000054.00510351095130000",
      ]) {
        const nv = new NumericValue(bigDecimal, "bigDecimal");
        const serialized = cbor.serialize(nv);

        const major = serialized[0] >> 5;
        expect(major).toEqual(0b110); // 6

        const tag = serialized[0] & 0b11111;
        expect(tag).toEqual(0b0100); // 4

        const deserialized = cbor.deserialize(serialized);
        expect(deserialized).toEqual(nv);
        expect(deserialized.string).toEqual(nv.string);
      }
    });

    it("should throw an error if serializing a tag with missing properties", () => {
      expect(() =>
        cbor.serialize({
          myTag: {
            [tagSymbol]: true,
            tag: 1,
            // value: undefined
          },
        })
      ).toThrowError("tag encountered with missing fields, need 'tag' and 'value', found: {\"tag\":1}");
      cbor.resizeEncodingBuffer(0);
    });

    for (const { name, data, cbor: cbor_representation } of examples) {
      it(`should encode for ${name}`, async () => {
        const serialized = cbor.serialize(data);
        expect(allocByteArray(serialized.buffer, serialized.byteOffset, serialized.byteLength)).toEqual(
          cbor_representation
        );
      });

      it(`should decode for ${name}`, async () => {
        const deserialized = cbor.deserialize(cbor_representation);
        expect(deserialized).toEqual(data);
      });
    }
  });

  describe("externally curated scenarios", () => {
    for (const { description, input, error } of errorTests) {
      it(description, () => {
        expect(error).toBe(true);
        const bytes = toBytes(input);
        expect(() => {
          cbor.deserialize(bytes);
        }).toThrow();
      });
    }

    function binaryToFloat32(b: number) {
      const dv = new DataView(new ArrayBuffer(4));
      dv.setInt32(0, Number(b));
      return dv.getFloat32(0);
    }

    function binaryToFloat64(b: number) {
      const binaryArray = b.toString(2).split("").map(Number);
      const pad = Array(64).fill(0);
      const binary64 = new Uint8Array(pad.concat(binaryArray).slice(-64));

      const sign = binary64[0];
      const exponent = Number("0b" + Array.from(binary64.subarray(1, 12)).join(""));
      const fraction = binary64.subarray(12);

      const scalar = (-1) ** sign;
      let sum = 1;
      for (let i = 1; i <= 52; ++i) {
        const position = i - 1;
        const bit = fraction[position];
        sum += 2 ** -i * bit;
      }
      const exponentScalar = Math.pow(2, exponent - 1023);
      return scalar * sum * exponentScalar;
    }

    function translateTestData(data: any): any {
      const [type, value] = Object.entries(data)[0] as [string, any];
      switch (type) {
        case "null":
          return null;
        case "uint":
        case "negint":
        case "bool":
        case "string":
          return value;
        case "float32":
          return binaryToFloat32(value);
        case "float64":
          return binaryToFloat64(value);
        case "bytestring":
          return allocByteArray(value.map(Number));
        case "list":
          return value.map(translateTestData);
        case "map":
          const output = {} as Record<string, any>;
          for (const [k, v] of Object.entries(value)) {
            output[k] = translateTestData(v);
          }
          return output;
        case "tag":
          const { id, value: tagValue } = value;
          return {
            tag: id,
            value: translateTestData(tagValue),
            [tagSymbol]: true,
          };
        default:
          throw new Error(`Unrecognized test scenario <expect> type ${type}.`);
      }
    }

    for (const { description, input, expect: _expect } of successTests) {
      const bytes = toBytes(input);
      const jsObject = translateTestData(_expect);

      it(`serialization for ${description}`, () => {
        const serialized = allocByteArray(cbor.serialize(jsObject));
        const redeserialized = cbor.deserialize(serialized);

        /**
         * We cannot assert that serialized == bytes,
         * because there are multiple serializations
         * that deserialize to the same object.
         */
        expect(redeserialized).toEqual(jsObject);
      });
      it(`deserialization for ${description}`, () => {
        const deserialized = cbor.deserialize(bytes);
        expect(deserialized).toEqual(jsObject);
      });
    }
  });
});

describe("bytesToFloat16", () => {
  it("should convert two bytes to float16", () => {
    expect(bytesToFloat16(0b0_10100_00, 0b0101_0000)).toEqual(34.5);

    expect(bytesToFloat16(0b0_00000_00, 0b0000_0000)).toEqual(0.0);
    expect(bytesToFloat16(0b0_00000_00, 0b0000_0001)).toEqual(5.960464477539063e-8);
    expect(bytesToFloat16(0b0_00001_00, 0b0000_0000)).toEqual(0.00006103515625);

    expect(bytesToFloat16(0b0_01101_01, 0b0101_0101)).toEqual(0.333251953125);
    expect(bytesToFloat16(0b0_01110_11, 0b1111_1111)).toEqual(0.99951171875);
    expect(bytesToFloat16(0b0_01111_00, 0b0000_0000)).toEqual(1.0);
    expect(bytesToFloat16(0b0_01111_00, 0b0000_0001)).toEqual(1.0009765625);
    expect(bytesToFloat16(0b0_11110_11, 0b1111_1111)).toEqual(65504.0);

    expect(bytesToFloat16(0b0_11111_00, 0b0000_0000)).toEqual(Infinity);
    // expect(bytesToFloat16(0b1_00000_00, 0b0000_0000)).toEqual(-0);
    expect(bytesToFloat16(0b1_10000_00, 0b0000_0000)).toEqual(-2);
    expect(bytesToFloat16(0b1_11111_00, 0b0000_0000)).toEqual(-Infinity);
  });
});
