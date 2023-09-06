namespace smithy.example

// This test input is used to validate that the generated client properly injects
// the HTTP API key authentication middleware with the correct options.
//
// In this case the operations all have the `@optionalAuth` trait, so the middleware
// should not be injected at all.

@httpApiKeyAuth(in: "header", name: "Authorization", scheme: "ApiKey")
service Example {
    version: "2019-10-15",
    operations: [GetFoo, GetBar]
}

@optionalAuth
operation GetFoo {
    input: GetFooInput,
    output: GetFooOutput,
    errors: [GetFooError]
}

structure GetFooInput {}
structure GetFooOutput {}

@error("client")
structure GetFooError {}

@optionalAuth
operation GetBar {
    input: GetBarInput,
    output: GetBarOutput,
    errors: [GetBarError]
}

structure GetBarInput {}
structure GetBarOutput {}

@error("client")
structure GetBarError {}

