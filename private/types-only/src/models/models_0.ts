// smithy-typescript generated code
import type { ConservationStatus } from "./enums";
import type { BirdError } from "./errors";

/**
 * @public
 */
export interface BirdMeasurements {
  minWingspanCm?: number | undefined;
  maxWingspanCm?: number | undefined;
  minLengthCm?: number | undefined;
  maxLengthCm?: number | undefined;
  minWeightGrams?: number | undefined;
  maxWeightGrams?: number | undefined;
}

/**
 * @public
 */
export interface CavityNest {
  substrate?: string | undefined;
  entranceDiameterCm?: number | undefined;
  depthCm?: number | undefined;
}

/**
 * @public
 */
export interface GroundNest {
  habitat?: string | undefined;
  concealed?: boolean | undefined;
}

/**
 * @public
 */
export interface OpenCupNest {
  placement?: string | undefined;
  primaryMaterial?: string | undefined;
  liningMaterial?: string | undefined;
}

/**
 * @public
 */
export type Nest =
  | Nest.CavityMember
  | Nest.GroundMember
  | Nest.OpenCupMember
  | Nest.$UnknownMember;

/**
 * @public
 */
export namespace Nest {
  export interface OpenCupMember {
    openCup: OpenCupNest;
    cavity?: never;
    ground?: never;
    $unknown?: never;
  }

  export interface CavityMember {
    openCup?: never;
    cavity: CavityNest;
    ground?: never;
    $unknown?: never;
  }

  export interface GroundMember {
    openCup?: never;
    cavity?: never;
    ground: GroundNest;
    $unknown?: never;
  }

  /**
   * @public
   */
  export interface $UnknownMember {
    openCup?: never;
    cavity?: never;
    ground?: never;
    $unknown: [string, any];
  }

  /**
   * @deprecated unused in schema-serde mode.
   *
   */
  export interface Visitor<T> {
    openCup: (value: OpenCupNest) => T;
    cavity: (value: CavityNest) => T;
    ground: (value: GroundNest) => T;
    _: (name: string, value: any) => T;
  }
}

/**
 * @public
 */
export interface ScientificClassification {
  order?: string | undefined;
  family?: string | undefined;
  genus?: string | undefined;
  species?: string | undefined;
}

/**
 * A standalone data shape generated in types-only mode.
 * @public
 */
export interface Bird {
  name?: string | undefined;
  scientificClassification?: ScientificClassification | undefined;
  measurements?: BirdMeasurements | undefined;
  conservationStatus?: ConservationStatus | undefined;
  tags?: string[] | undefined;
  nest?: Nest | undefined;
  /**
   * Error shapes in a closure generate throwable classes extending the
   * generic ServiceException base, since types mode has no service.
   * @public
   */
  problem?: BirdError | undefined;
}
