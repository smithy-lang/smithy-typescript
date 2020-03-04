namespace smithy.example

@protocols([{name: "aws.rest-json-1.1"}])
service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo(GetFooInput) -> GetFooOutput errors [GetFooError]
structure GetFooInput {}
structure GetFooOutput {}

@error("client")
structure GetFooError {}
