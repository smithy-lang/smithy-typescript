namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo {
    input: GetFooInput
}

structure GetFooInput {
    @required
    foo: Bar,

    @required
    baz: another.example#Bar
}
