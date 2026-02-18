import { NormalizedSchema } from "@smithy/core/schema";
import { NumericValue } from "@smithy/core/serde";
import type { $SchemaRef } from "@smithy/types";

/**
 * Creates a static value for a given schema.
 *
 * @internal
 *
 * @param schema - for which to generate an object.
 * @param path - to cut off recursive schema at a certain depth.
 */
export function createFromSchema(schema: $SchemaRef, path = ""): any {
  const $ = NormalizedSchema.of(schema);

  const memberName = $.isMemberSchema() ? $.getMemberName() : "____";
  const qualifiedName = $.getName(true) ?? "UnknownSchema!";
  path += " -> " + qualifiedName + "$" + memberName;

  const haltRecursion = path.split(qualifiedName).length >= 4;

  if ($.isStringSchema()) {
    if ($.isIdempotencyToken()) {
      return "00000000-0000-4000-8000-000000000000";
    }
    return customFields[memberName] ?? "__" + memberName + "__";
  } else if ($.isNumericSchema()) {
    return 0;
  } else if ($.isBigIntegerSchema()) {
    return BigInt(1000001);
  } else if ($.isBigDecimalSchema()) {
    return new NumericValue("9876543210.0123456789", "bigDecimal");
  } else if ($.isBooleanSchema()) {
    return false;
  } else if ($.isBlobSchema()) {
    return new Uint8Array([1, 0, 0, 1]);
  } else if ($.isTimestampSchema()) {
    return new Date(946702799999);
  } else if ($.isMapSchema()) {
    const map = {} as any;
    if (haltRecursion) {
      return map;
    }
    const $v = $.getValueSchema();
    map.key1 = createFromSchema($v, path + "$k1");
    map.key2 = createFromSchema($v, path + "$k2");
    map.key2 = createFromSchema($v, path + "$k3");
    return map;
  } else if ($.isListSchema()) {
    const list = [] as any;
    if (haltRecursion) {
      return list;
    }
    const $v = $.getValueSchema();
    list.push(
      createFromSchema($v, path + "$l1"),
      createFromSchema($v, path + "$l2"),
      createFromSchema($v, path + "$l3")
    );
    return list;
  } else if ($.isStructSchema()) {
    const isUnion = $.isUnionSchema();
    const isEventStream = isUnion && $.isStreaming();
    const struct = {} as any;
    if (isEventStream) {
      return {
        async *[Symbol.asyncIterator]() {
          for (const [memberName, $member] of $.structIterator()) {
            yield {
              [memberName]: createFromSchema($member, path),
            };
          }
        },
      };
    } else {
      if (haltRecursion) {
        return struct;
      }
      const unionMemberSelector =
        path.split("").reduce((a, c) => {
          return a + c.charCodeAt(0);
        }, 0) % Object.entries($.getMemberSchemas()).length;

      let i = 0;

      for (const [memberName, $member] of $.structIterator()) {
        if (!isUnion || i++ === unionMemberSelector) {
          struct[memberName] = createFromSchema($member, path);
          if (isUnion) {
            break;
          }
        }
      }
    }
    return struct;
  } else if ($.isUnitSchema()) {
    return {};
  } else if ($.isDocumentSchema()) {
    return {
      doc_note: "this is a document",
      doc_date: new Date(946702799999),
      doc_blob: new Uint8Array([1, 0, 0, 1]),
      doc_list: [-7, -3, 0, 1, 5],
    };
  }
  console.warn("WARN: Unsupported schema type in snapshot test", $);
  return "UNSUPPORTED_SCHEMA_TYPE";
}

const customFields: Record<string, string> = {
  PredictEndpoint: "https://localhost",
  ChecksumAlgorithm: "CRC64NVME",
};
