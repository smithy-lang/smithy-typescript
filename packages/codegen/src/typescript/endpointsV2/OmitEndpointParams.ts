const OMITTED_PARAMS = new Set<string>();

/**
 * Endpoint parameters that are left out of the generated client parameters.
 */
export class OmitEndpointParams {
  private constructor() {}

  public static isOmitted(paramName: string): boolean {
    return OMITTED_PARAMS.has(paramName);
  }
}
