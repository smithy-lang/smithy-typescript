// smithy-typescript generated code
/**
 * @public
 * @enum
 */
export const ConservationStatus = {
  ENDANGERED: "ENDANGERED",
  LEAST_CONCERN: "LEAST_CONCERN",
  NEAR_THREATENED: "NEAR_THREATENED",
  VULNERABLE: "VULNERABLE",
} as const;
/**
 * @public
 */
export type ConservationStatus = (typeof ConservationStatus)[keyof typeof ConservationStatus];
