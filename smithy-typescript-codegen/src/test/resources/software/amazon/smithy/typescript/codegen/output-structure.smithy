namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [GetFoo]
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
