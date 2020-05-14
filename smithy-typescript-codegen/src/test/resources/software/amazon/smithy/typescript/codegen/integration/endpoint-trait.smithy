namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

@readonly
@endpoint(hostPrefix: "{foo}.data.")
operation GetFoo {
    input: GetFooInput,
    output: GetFooOutput
}

structure GetFooInput {
    @required
    @hostLabel
    foo: String
}
structure GetFooOutput {}
