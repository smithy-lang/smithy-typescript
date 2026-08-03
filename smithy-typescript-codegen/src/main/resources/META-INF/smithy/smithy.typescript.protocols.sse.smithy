$version: "2.0"

namespace smithy.typescript.protocols

use smithy.api#cors
use smithy.api#endpoint
use smithy.api#hostLabel
use smithy.api#http
use smithy.api#httpError
use smithy.api#httpHeader
use smithy.api#httpLabel
use smithy.api#httpPayload
use smithy.api#httpPrefixHeaders
use smithy.api#httpQuery
use smithy.api#httpQueryParams
use smithy.api#httpResponseCode
use smithy.api#jsonName
use smithy.api#timestampFormat

/// An HTTP protocol that serializes structures as JSON and frames event
/// streams as Server-Sent Events (text/event-stream).
@trait(selector: "service")
@protocolDefinition(
    traits: [
        cors
        endpoint
        hostLabel
        http
        httpError
        httpHeader
        httpLabel
        httpPayload
        httpPrefixHeaders
        httpQuery
        httpQueryParams
        httpResponseCode
        jsonName
        timestampFormat
    ]
)
structure sseJson {}
