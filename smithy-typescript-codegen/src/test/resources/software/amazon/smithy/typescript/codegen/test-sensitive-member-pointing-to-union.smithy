namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo {
    input: GetFooInput
}

structure GetFooInput {
    @sensitive
    sensitiveFoo: TestUnion
}

union TestUnion {
    fooString: String,
    barString: String
}
