namespace smithy.example

@protocols([{name: "aws.rest-json-1.1"}])
service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

@readonly
@endpoint(hostPrefix: "{foo}.data.")
operation GetFoo(GetFooInput) -> GetFooOutput
structure GetFooInput {
    @required
    @hostLabel
    foo: String
}
structure GetFooOutput {}
