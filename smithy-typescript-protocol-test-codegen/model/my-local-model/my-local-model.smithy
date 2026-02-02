$version: "2.0"

namespace org.xyz.v1

use org.xyz.secondary#HttpLabelCommand
use smithy.protocols#rpcv2Cbor
use smithy.rules#clientContextParams
use smithy.rules#endpointRuleSet
use smithy.test#httpRequestTests
use smithy.test#httpResponseTests
use smithy.waiters#waitable

@rpcv2Cbor
@documentation("xyz interfaces")
@httpApiKeyAuth(name: "X-Api-Key", in: "header")
@clientContextParams(
    customParam: { type: "string", documentation: "Custom parameter" }
    region: { type: "string", documentation: "Conflicting with built-in region" }
    enableFeature: { type: "boolean", documentation: "Feature toggle flag" }
    debugMode: { type: "boolean", documentation: "Debug mode flag" }
    nonConflictingParam: { type: "string", documentation: "Non-conflicting parameter" }
    logger: { type: "string", documentation: "Conflicting logger parameter" }
    ApiKey: { type: "string", documentation: "ApiKey" }
)
@endpointRuleSet({
    version: "1.0"
    parameters: {
        endpoint: { builtIn: "SDK::Endpoint", required: true, documentation: "The endpoint used to send the request.", type: "string" }
        ApiKey: { required: false, documentation: "ApiKey", type: "string" }
        region: { type: "string", required: false, documentation: "AWS region" }
        customParam: { type: "string", required: true, default: "default-custom-value", documentation: "Custom parameter for testing" }
        enableFeature: { type: "boolean", required: true, default: true, documentation: "Feature toggle with default" }
        debugMode: { type: "boolean", required: true, default: false, documentation: "Debug mode with default" }
        nonConflictingParam: { type: "string", required: true, default: "non-conflict-default", documentation: "Non-conflicting with default" }
        logger: { type: "string", required: true, default: "default-logger", documentation: "Conflicting logger with default" }
    }
    rules: [
        {
            conditions: [
                {
                    fn: "isSet"
                    argv: [
                        {
                            ref: "ApiKey"
                        }
                    ]
                }
            ]
            endpoint: {
                url: "{endpoint}"
                properties: {}
                headers: {
                    "x-api-key": ["{ApiKey}"]
                }
            }
            type: "endpoint"
        }
        {
            conditions: []
            endpoint: {
                url: "{endpoint}"
                properties: {}
                headers: {}
            }
            type: "endpoint"
        }
    ]
})
service XYZService {
    version: "1.0"
    operations: [
        GetNumbers
        TradeEventStream
        camelCaseOperation
        HttpLabelCommand
    ]
    errors: [
        MainServiceLinkedError
    ]
}

@error("client")
@httpError(400)
structure MainServiceLinkedError {}

@waitable(
    NumbersAligned: {
        documentation: "wait until the numbers align"
        acceptors: [
            {
                state: "success"
                matcher: { success: true }
            }
            {
                state: "retry"
                matcher: { errorType: "MysteryThrottlingError" }
            }
            {
                state: "failure"
                matcher: { errorType: "HaltError" }
            }
        ]
    }
)
@paginated(inputToken: "startToken", outputToken: "nextToken", pageSize: "maxResults", items: "numbers")
@readonly
@httpRequestTests([
    {
        id: "GetNumbersRequestExample"
        protocol: "smithy.protocols#rpcv2Cbor"
        method: "POST"
        uri: "/service/XYZService/operation/GetNumbers"
        tags: ["serde-benchmark"]
    }
])
@httpResponseTests([
    {
        id: "GetNumbersResponseExample"
        protocol: "smithy.protocols#rpcv2Cbor"
        code: 200
        headers: { "smithy-protocol": "rpc-v2-cbor" }
        tags: ["serde-benchmark"]
    }
])
@http(method: "POST", uri: "/get-numbers", code: 200)
operation GetNumbers {
    input: GetNumbersRequest
    output: GetNumbersResponse
    errors: [
        CodedThrottlingError
        MysteryThrottlingError
        RetryableError
        HaltError
        XYZServiceServiceException
    ]
}

@input
structure GetNumbersRequest {
    bigDecimal: BigDecimal

    bigInteger: BigInteger

    @documentation("This is deprecated documentation annotation")
    @deprecated
    fieldWithoutMessage: String

    @documentation("This is deprecated documentation annotation")
    @deprecated(message: "This field has been deprecated", since: "3.0")
    fieldWithMessage: String

    startToken: String

    maxResults: Integer
}

@output
structure GetNumbersResponse {
    bigDecimal: BigDecimal
    bigInteger: BigInteger
    numbers: IntegerList
    nextToken: String
}

list IntegerList {
    member: Integer
}

@error("client")
@retryable(throttling: true)
@httpError(429)
structure CodedThrottlingError {}

@error("client")
@retryable(throttling: true)
structure MysteryThrottlingError {}

@error("client")
@retryable
structure RetryableError {}

@error("client")
structure HaltError {}

@error("client")
structure XYZServiceServiceException {}

@http(method: "POST", uri: "/trade-event-stream", code: 200)
operation TradeEventStream {
    input: TradeEventStreamRequest
    output: TradeEventStreamResponse
}

structure TradeEventStreamRequest {
    eventStream: TradeEvents
}

structure TradeEventStreamResponse {
    eventStream: TradeEvents
}

@streaming
union TradeEvents {
    alpha: Alpha
    beta: Unit
    gamma: Unit
}

structure Alpha {
    id: String
    timestamp: Timestamp
}

@rpcv2Cbor
@documentation("a second service in the same model, unused.")
service UnusedService {
    version: "1.0"
    operations: [
        UnusedOperation
    ]
    errors: [
        UnusedServiceLinkedError
    ]
}

@http(method: "POST", uri: "/unused", code: 200)
operation UnusedOperation {
    input: Unit
    output: Unit
    errors: [
        UnusedServiceOperationLinkedError
    ]
}

@error("client")
@httpError(400)
structure UnusedServiceOperationLinkedError {}

@error("client")
@httpError(400)
structure UnusedServiceLinkedError {}

@error("client")
@httpError(400)
structure CompletelyUnlinkedError {}

@paginated(inputToken: "token", outputToken: "token", items: "results")
@readonly
@http(method: "POST", uri: "/camel-case", code: 200)
operation camelCaseOperation {
    input := {
        token: String
    }
    output := {
        token: String
        results: Blobs
    }
}

list Blobs {
    member: Blob
}
