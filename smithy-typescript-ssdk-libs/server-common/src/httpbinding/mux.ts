/*
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *   http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

import { HttpRequest } from "@aws-sdk/types";

import { Mux, ServiceCoordinate } from "..";

export interface PathLiteralSegment {
  type: "path_literal";
  value: string;
}

export interface PathLabelSegment {
  type: "path";
}

export interface GreedySegment {
  type: "greedy";
}

export interface QueryLiteralSegment {
  type: "query_literal";
  key: string;
  value?: string;
}

export interface QuerySegment {
  type: "query";
  key: string;
}
export class UriSpec<S extends string, O extends string> {
  private readonly method: string;
  private readonly pathSegments: (PathLiteralSegment | PathLabelSegment | GreedySegment)[];
  private readonly querySegments: (QueryLiteralSegment | QuerySegment)[];
  readonly rank: number;
  readonly target: ServiceCoordinate<S, O>;

  constructor(
    method: string,
    pathSegments: (PathLiteralSegment | PathLabelSegment | GreedySegment)[],
    querySegments: (QueryLiteralSegment | QuerySegment)[],
    target: ServiceCoordinate<S, O>
  ) {
    this.method = method;
    this.pathSegments = pathSegments;
    this.querySegments = querySegments;
    this.rank = this.pathSegments.length + this.querySegments.length;
    this.target = target;
  }

  private matchesSegment(
    requestSegment: string,
    segment: PathLiteralSegment | PathLabelSegment | GreedySegment
  ): boolean {
    if (segment.type === "path_literal" && requestSegment !== segment.value) {
      return false;
    }
    return true;
  }

  match(req: HttpRequest): boolean {
    if (req.method !== this.method) {
      return false;
    }

    const requestPathSegments = req.path.split("/").filter((s) => s.length > 0);

    let requestPathIdx = 0;
    path_loop: for (let i = 0; i < this.pathSegments.length; i++) {
      if (requestPathIdx === requestPathSegments.length) {
        // there are more pathSegments but we have reached the end of the requestPath
        return false;
      }
      const pathSegment = this.pathSegments[i];
      if (pathSegment.type === "path_literal" && pathSegment.value !== requestPathSegments[requestPathIdx]) {
        return false;
      }
      if (pathSegment.type === "greedy") {
        if (i === this.pathSegments.length - 1) {
          // greedy label at the end of pathSegments swallows the remaining path segments
          requestPathIdx = requestPathSegments.length;
          break path_loop;
        }
        let matched = false;
        if (i < this.pathSegments.length - 1) {
          const nextSegment = this.pathSegments[i + 1];
          while (!matched && ++requestPathIdx < requestPathSegments.length) {
            if (this.matchesSegment(requestPathSegments[requestPathIdx], nextSegment)) {
              matched = true;
            }
          }
        }
        if (!matched) {
          // the next segment after our greedy label did not match any of the remaining request segments
          return false;
        }
      } else {
        requestPathIdx++;
      }
    }

    if (requestPathIdx < requestPathSegments.length) {
      // we reached the end of our defined path segments without reaching the end of the request path
      return false;
    }

    if (this.querySegments.length === 0) {
      return true;
    }

    if (!req.query) {
      return false;
    }

    for (const querySegment of this.querySegments) {
      if (!(querySegment.key in req.query)) {
        return false;
      }
      if (querySegment.type === "query_literal") {
        if (querySegment.value && querySegment.value !== req.query[querySegment.key]) {
          return false;
        }
      }
    }
    return true;
  }
}

export class HttpBindingMux<S extends string, O extends string> implements Mux<S, O> {
  private readonly specs: UriSpec<S, O>[];

  constructor(inputSpecs: UriSpec<S, O>[]) {
    this.specs = inputSpecs.sort((s1, s2) => s2.rank - s1.rank);
  }

  match(req: HttpRequest): ServiceCoordinate<S, O> | undefined {
    return this.specs.find((s) => s.match(req))?.target;
  }
}
