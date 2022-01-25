namespace smithy.example

// This test input is used to validate that the generated client properly injects
// the HTTP API key authentication middleware with the correct options.
//
// In this case the options should not include the `scheme` attribute.

@httpApiKeyAuth(in: "header", name: "Authorization")
@auth([httpApiKeyAuth])
service Example {
    version: "2019-10-15",
    operations: [GetFoo, GetBar]
}

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

