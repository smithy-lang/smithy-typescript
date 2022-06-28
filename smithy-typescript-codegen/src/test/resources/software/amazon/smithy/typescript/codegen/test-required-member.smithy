namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo {
    input: GetFooInput,
    output: GetFooOutput
}

structure GetFooInput {}
structure GetFooOutput {
    @required
    someRequiredMember: String
}
