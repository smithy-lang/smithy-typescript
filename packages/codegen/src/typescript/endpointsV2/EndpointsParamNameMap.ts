const MAPPING = new Map<string, string>();

/**
 * Maps endpoint parameter names to the names used in client config.
 */
export class EndpointsParamNameMap {
  private constructor() {}

  public static getLocalName(endpointsV2ParamName: string): string {
    let isTitleCase = false;
    if (endpointsV2ParamName.length >= 2) {
      const char1 = endpointsV2ParamName.substring(0, 1);
      const char2 = endpointsV2ParamName.substring(1, 2);
      if (char1.toUpperCase() === char1 && char2.toLowerCase() === char2) {
        isTitleCase = true;
      }
    }
    let suggestedName = endpointsV2ParamName;
    if (isTitleCase) {
      suggestedName = endpointsV2ParamName.substring(0, 1).toLowerCase() + endpointsV2ParamName.substring(1);
    }
    return MAPPING.get(endpointsV2ParamName) ?? suggestedName;
  }
}
