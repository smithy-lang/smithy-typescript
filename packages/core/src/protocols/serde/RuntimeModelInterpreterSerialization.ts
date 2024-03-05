import type { HttpRequest as IHttpRequest, SerdeContext } from "@smithy/types";

import type { RequestBuilder } from "../requestBuilder";
import type {
  ISmithyModelOperationShape,
  ISmithyModelShapeId,
  ISmithyModelStructureShape,
  ISmithyModelTraits,
} from "./SmithyModel";

/**
 * This is an optional guide-rail for extending {@link RuntimeModelInterpreter}
 * which helps with implementing the serialization side.
 *
 * Extend {@link RuntimeModelInterpreter} and then implement this interface
 * using it as a reference for what functionality is needed.
 *
 * The interface's methods are grouped by number prefix, and the implementation
 * should find that all methods are accounted for (none unused) and
 * are called in the order of their grouping prefix.
 * Methods having the same number prefix can be called in any order.
 */
export interface RuntimeModelInterpreterSerialization {
  /**
   * This is the primary top level method this interface will outline.
   */
  serialize<I>(input: I, operationShapeId: ISmithyModelShapeId, context: SerdeContext): Promise<IHttpRequest>;

  /**
   * Initialize the operation shape from the top level input, to
   * retrieve the request shape next.
   */
  se_0_getOperationShape(operationShapeId: ISmithyModelShapeId): ISmithyModelOperationShape;

  /**
   * Get the request shape. The implementation will be iterating over its members.
   */
  se_1_getRequestShape(responseShapeId: ISmithyModelShapeId): ISmithyModelStructureShape;

  /**
   * Call {@link RequestBuilder.prototype.bp} with the operation's http trait.
   */
  se_2_traitHttp(http: ISmithyModelTraits["smithy.api#http"], b: RequestBuilder): void;

  /**
   * Initialize headers object.
   */
  se_2_initHeaders(): Record<string, string>;

  /**
   * initialize query object.
   */
  se_2_initQuery(): Record<string, string>;

  /**
   * Iterate over Object.entries(requestShape.members).
   */
  se_3_iterateRequestShapeMembers(
    entries: [string, ISmithyModelStructureShape["members"][""]][],
    iterationFn: (entry: typeof entries[0]) => Promise<void>
  ): Promise<void>;

  /**
   * Within member iteration, conditionally handle the http header trait.
   * Set the value on the headers object.
   */
  se_4_memberTraitHttpHeader(
    httpHeader: ISmithyModelTraits["smithy.api#httpHeader"],
    memberName: string,
    input: any,
    headers: Record<string, string>
  ): void;

  /**
   * Within member iteration, conditionally handle the http query trait.
   * Set the value on the query object.
   */
  se_4_memberTraitHttpQuery(
    httpQuery: ISmithyModelTraits["smithy.api#httpQuery"],
    memberName: string,
    input: any,
    query: Record<string, string>
  ): void;

  /**
   * Within member iteration, conditionally handle the http label trait.
   * Call {@link RequestBuilder.prototype.p}.
   */
  se_4_memberTraitHttpLabel(
    httpLabel: ISmithyModelTraits["smithy.api#httpLabel"],
    memberName: string,
    input: any,
    b: RequestBuilder
  ): void;

  /**
   * Within member iteration, conditionally handle the http header trait.
   *
   * @returns the HttpRequest body value.
   */
  se_4_memberTraitHttpPayload(
    httpPayload: ISmithyModelTraits["smithy.api#httpPayload"],
    memberName: string,
    input: any
  ): any;

  /**
   * Conditionally handle a member with no trait. This usually means being written
   * to the same field on the body object before its serialization.
   *
   * This should be exclusive with the httpPayload trait.
   *
   * Since the implementation varies for this step, it is only a caller
   * of your supplied function.
   */
  se_4_memberWithoutTrait(fn: () => void | Promise<void>): void | Promise<void>;
}
