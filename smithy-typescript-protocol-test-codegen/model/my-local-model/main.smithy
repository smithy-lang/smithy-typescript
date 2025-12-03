$version: "2.0"

namespace org.xyz.v1

use smithy.protocols#rpcv2Cbor
use smithy.rules#clientContextParams
use smithy.rules#endpointRuleSet

@rpcv2Cbor
@documentation("xyz interfaces")
@httpApiKeyAuth(name: "X-Api-Key", in: "header")
@clientContextParams(
    customParam: { type: "string", documentation: "Custom parameter" }
    region: { type: "string", documentation: "Conflicting with built-in region" }
    enableFeature: { type: "boolean", documentation: "Feature toggle flag" }
    debugMode: { type: "boolean", documentation: "Debug mode flag" }
    nonConflictingParam: { type: "string", documentation: "Non-conflicting parameter" }
    ApiKey: { type: "string", documentation: "ApiKey" }
)
@endpointRuleSet({
    version: "1.0"
    parameters: {
        endpoint: { builtIn: "SDK::Endpoint", required: true, documentation: "The endpoint used to send the request.", type: "String" }
        ApiKey: { required: false, documentation: "ApiKey", type: "String" }
        region: { type: "String", required: false, documentation: "AWS region" }
        customParam: { type: "String", required: true, default: "default-custom-value", documentation: "Custom parameter for testing" }
        enableFeature: { type: "Boolean", required: true, default: true, documentation: "Feature toggle with default" }
        debugMode: { type: "Boolean", required: true, default: false, documentation: "Debug mode with default" }
        nonConflictingParam: { type: "String", required: true, default: "non-conflict-default", documentation: "Non-conflicting with default" }
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
    ]
    errors: [
        MainServiceLinkedError
    ]
}

@error("client")
@httpError(400)
structure MainServiceLinkedError {}

@readonly
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
}

@output
structure GetNumbersResponse {
    bigDecimal: BigDecimal
    bigInteger: BigInteger
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
