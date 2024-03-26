import type { HttpResponse as IHttpResponse, MetadataBearer, SerdeContext } from "@smithy/types";

import type {
  ISmithyModelOperationShape,
  ISmithyModelShapeId,
  ISmithyModelStructureShape,
  ISmithyModelTraits,
} from "./SmithyModel";

/**
 * This is an optional guide-rail for extending {@link RuntimeModelInterpreter}
 * which helps with implementing the deserialization side.
 *
 * Extend {@link RuntimeModelInterpreter} and then implement this interface
 * using it as a reference for what functionality is needed.
 *
 * The interface's methods are grouped by number prefix, and the implementation
 * should find that all methods are accounted for (none unused) and
 * are called in the order of their grouping prefix.
 * Methods having the same number prefix can be called in any order.
 */
export interface RuntimeModelInterpreterDeserialization {
  /**
   * This is the primary top level method this interface will outline.
   */
  deserialize<O>(httpResponse: IHttpResponse, operationShapeId: ISmithyModelShapeId, context: SerdeContext): Promise<O>;

  /**
   * Handle error status, such as statusCode >= 300.
   */
  de_0_handleErrorStatusCode(httpResponse: IHttpResponse): void;

  /**
   * Initialize the operation shape from the top level input, to
   * retrieve the response shape next.
   */
  de_1_getOperationShape(operationShapeId: ISmithyModelShapeId): ISmithyModelOperationShape;

  /**
   * Get the response shape. The implementation will iterate over its members.
   */
  de_2_getResponseShape(responseShapeId: ISmithyModelShapeId): ISmithyModelStructureShape;

  /**
   * Initialize output object to be returned at the end.
   * It should be a MetadataBearer.
   */
  de_3_initializeOutputWithMetadata(httpResponse: IHttpResponse): MetadataBearer & any;

  /**
   * Iterate over Object.entries(responseShape.members).
   * After this loop, the output from {@link #de_initializeOutputWithMetadata} should be ready to be returned in the top level
   * deserialize function.
   */
  de_5_iterateResponseShapeMembers(
    entries: [string, ISmithyModelStructureShape["members"][""]][],
    iterationFn: (entry: typeof entries[0]) => Promise<void>
  ): Promise<void>;

  /**
   * Within member iteration, conditionally handle member trait
   * httpResponseCode.
   */
  de_6_memberTraitHttpResponseCode(
    httpResponseCode: ISmithyModelTraits["smithy.api#httpResponseCode"],
    memberName: string,
    output: any,
    httpResponse: IHttpResponse
  ): void;

  /**
   * Within member iteration, conditionally handle member trait
   * httpHeader.
   */
  de_6_memberTraitHttpHeader(
    httpHeader: ISmithyModelTraits["smithy.api#httpHeader"],
    memberName: string,
    output: any,
    httpResponse: IHttpResponse
  ): void;

  /**
   * Within member iteration, conditionally handle member trait
   * httpPayload.
   */
  de_6_memberTraitHttpPayload(
    httpPayload: ISmithyModelTraits["smithy.api#httpPayload"],
    memberName: string,
    output: any,
    httpResponse: IHttpResponse,
    context: SerdeContext
  ): Promise<void>;

  /**
   * Within member iteration, conditionally handle members with no trait.
   * This usually means they are to be written to the response object as-is
   * or with some formatting transform.
   *
   * Since the implementation varies for this step, it is only a caller
   * of your supplied function.
   */
  de_6_memberWithoutTrait(fn: () => void | Promise<void>): void | Promise<void>;
}
