namespace smithy.example

@protocols([{name: "aws.rest-json-1.1"}])
service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo(GetFooInput)

structure GetFooInput {
    @required
    foo: Bar,

    @required
    baz: another.example#Bar
}

namespace smithy.example

structure Bar {
    @required
    baz: String
}

namespace another.example

structure Bar {
    @required
    baz: String
}

