import type { EvaluateOptions, ReferenceObject } from "../types";

export const getReferenceValue = ({ ref }: ReferenceObject, options: EvaluateOptions) => {
  return options.referenceRecord[ref] ?? options.endpointParams[ref];
};
