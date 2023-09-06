namespace smithy.example

// This test input is used to validate that the generated client properly injects
// the HTTP API key authentication middleware with the correct options.
//
// In this scenario the `@auth` trait is on the operation rather than the service.

@httpApiKeyAuth(in: "header", name: "Authorization", scheme: "ApiKey")
service Example {
    version: "2019-10-15",
    operations: [GetFoo, GetBar]
}

@auth([httpApiKeyAuth])
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

