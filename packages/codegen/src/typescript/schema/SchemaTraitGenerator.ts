import type { Trait } from "../../model";
import {
  AnnotationTrait,
  EndpointTrait,
  HttpErrorTrait,
  HttpTrait,
  LengthTrait,
  PatternTrait,
  RangeTrait,
  ShapeId,
  StringTrait,
  UniqueItemsTrait,
  XmlNamespaceTrait,
} from "../../model";
import { StringUtils } from "../../codegen-core";
import type { StringStore } from "../util";
import { SchemaTraitExtension } from "./SchemaTraitExtension";

const ANNOTATION_TRAIT_VALUE = "1";

const apiIds = (...names: string[]): Set<string> =>
  new Set(names.map((n) => ShapeId.from("smithy.api#" + n).toString()));

const ANNOTATION_TRAITS = apiIds(
  "xmlAttribute",
  "xmlFlattened",
  "eventHeader",
  "eventPayload",
  "streaming",
  "requiresLength",
  "httpLabel",
  "httpPayload",
  "httpQueryParams",
  "httpResponseCode",
  "httpChecksumRequired",
  "hostLabel",
  "sparse",
  "sensitive",
  "idempotencyToken"
);
const DATA_TRAITS = apiIds("httpError", "http", "endpoint", "xmlNamespace");
const STRING_TRAITS = apiIds(
  "timestampFormat",
  "jsonName",
  "mediaType",
  "xmlName",
  "httpHeader",
  "httpQuery",
  "httpPrefixHeaders",
  "error"
);

/**
 * Serializes trait values into the static schema representation.
 */
export class SchemaTraitGenerator {
  public serializeTraitData(trait: Trait, stringStore: StringStore): string {
    const id = trait.toShapeId().toString();
    if (id === "smithy.api#timestampFormat") {
      return "";
    }
    if (STRING_TRAITS.has(id) && trait instanceof StringTrait) {
      return stringStore.var(trait.getValue());
    }
    if (ANNOTATION_TRAITS.has(id) && trait instanceof AnnotationTrait) {
      return ANNOTATION_TRAIT_VALUE;
    }
    if (DATA_TRAITS.has(id)) {
      if (trait instanceof EndpointTrait) {
        return `[${StringUtils.escapeJavaString(trait.getHostPrefix().toString(), "")}]`;
      }
      if (trait instanceof XmlNamespaceTrait) {
        return `[${stringStore.var(trait.getPrefix() ?? "")}, ${stringStore.var(trait.getUri())}]`;
      }
      if (trait instanceof HttpErrorTrait) {
        return String(trait.getCode());
      }
      if (trait instanceof HttpTrait) {
        return `[${StringUtils.escapeJavaString(trait.getMethod(), "")}, ${StringUtils.escapeJavaString(trait.getUri().toString(), "")}, ${trait.getCode()}]`;
      }
    } else if (SchemaTraitExtension.INSTANCE.contains(trait)) {
      return SchemaTraitExtension.INSTANCE.render(trait);
    } else if (trait instanceof LengthTrait) {
      return `[${trait.getMin() ?? "undefined"}, ${trait.getMax() ?? "undefined"}]`;
    } else if (trait instanceof RangeTrait) {
      return `[${trait.getMin() ?? "undefined"}, ${trait.getMax() ?? "undefined"}]`;
    } else if (trait instanceof PatternTrait) {
      return stringStore.var(trait.getValue());
    } else if (trait instanceof UniqueItemsTrait) {
      return ANNOTATION_TRAIT_VALUE;
    }

    const name = `\`${trait.constructor.name}\``;
    if (trait instanceof StringTrait) {
      return `/* unhandled trait ${name} */ ${stringStore.var(trait.getValue())}`;
    }
    if (trait instanceof AnnotationTrait) {
      return `/* unhandled trait ${name} */ ${ANNOTATION_TRAIT_VALUE}`;
    }
    return `/* unhandled trait ${name} */ void 0`;
  }
}
