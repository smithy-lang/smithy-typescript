/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Identity established by the authenticate step.
 *
 * @public
 */
export interface Caller {
  readonly principal: string;
}

/**
 * Framework-owned request identity.
 *
 * The authenticated caller is added by the framework authentication step.
 * Caller is the only request identity attribute currently defined.
 *
 * @public
 */
export interface RequestIdentity<CallerType extends Caller = Caller> {
  readonly caller?: Readonly<CallerType>;
}

/**
 * Extracts the caller type carried by a request identity.
 *
 * @public
 */
export type IdentityCaller<Identity extends RequestIdentity> = NonNullable<Identity["caller"]>;
