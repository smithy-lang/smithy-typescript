$version: "2.0"

namespace example.interceptors

use common#fakeProtocol

/// Minimal service used to generate a checked-in server SDK example for
/// reviewing the interceptor pipeline emitted by the codegen.
@fakeProtocol
@httpApiKeyAuth(name: "X-Api-Key", in: "header")
@auth([])
service InterceptorExample {
    version: "2024-01-01"
    operations: [
        Ping
        GetItem
    ]
}

/// A plain operation with no auth. Exercises the full pipeline:
/// deserialize, validate, invoke, serialize.
@http(method: "POST", uri: "/ping")
operation Ping {
    input := {
        message: String
    }
    output := {
        message: String
    }
}

/// An operation that requires API key auth. Exercises the authenticate
/// step and the UnauthenticatedException path.
@readonly
@http(method: "GET", uri: "/item/{id}")
@auth([httpApiKeyAuth])
operation GetItem {
    input := {
        @required
        @httpLabel
        id: String
    }

    output := {
        id: String
        name: String
    }
}
