$version: "2.0"

namespace org.xyz.v1

use smithy.protocols#rpcv2Cbor

@rpcv2Cbor
@documentation("xyz interfaces")
service XYZService {
    version: "1.0"
    operations: [
        GetNumbers
        TradeEventStream
    ]
}

@readonly
operation GetNumbers {
    input: GetNumbersRequest
    output: GetNumbersResponse
    errors: [
        CodedThrottlingError
        MysteryThrottlingError
        RetryableError
        HaltError
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
