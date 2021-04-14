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

import { HttpRequest, HttpResponse } from "@aws-sdk/protocol-http";
import { HeaderBag, QueryParameterBag } from "@aws-sdk/types";
import {
    APIGatewayProxyEventV2,
    APIGatewayProxyResultV2,
    APIGatewayProxyEventHeaders,
    APIGatewayProxyEventQueryStringParameters
} from "aws-lambda";
import { Readable } from "stream";

export function convertEvent(event: APIGatewayProxyEventV2): HttpRequest {
    return new HttpRequest({
        method: event.requestContext.http.method,
        headers: convertHeaders(event.headers),
        query: convertQuery(event.queryStringParameters),
        path: event.rawPath,
        ...(event.body ? { body: Readable.from(Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8'))} : {} )
    })
}

export function convertResponse(response: HttpResponse) : APIGatewayProxyResultV2 {
    return {
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.body,
        isBase64Encoded: false
    }
}

// TODO: this can be rewritten with arrow functions / Object.fromEntries / filter
// but first we need to split up generated client and servers so we can have different
// language version targets.
function convertHeaders(headers: APIGatewayProxyEventHeaders): HeaderBag {
    const retVal: {[key: string]: string} = {};

    for (const key in headers) {
        const val = headers[key];
        if (val !== undefined) {
            retVal[key] = val;
        }
    }

    return retVal;
}

// TODO: this can be rewritten with arrow functions / Object.fromEntries / filter
function convertQuery(params: APIGatewayProxyEventQueryStringParameters | undefined): QueryParameterBag | undefined {
    if (params === undefined) {
        return undefined;
    }

    const retVal: {[key: string]: string | string[]} = {};

    for (const key in params) {
        const val = params[key];
        if (val !== undefined) {
            if (val.indexOf(',') !== -1) {
                retVal[key] = val;
            } else {
                retVal[key] = val.split(",");
            }
        }
    }

    return retVal;
}
