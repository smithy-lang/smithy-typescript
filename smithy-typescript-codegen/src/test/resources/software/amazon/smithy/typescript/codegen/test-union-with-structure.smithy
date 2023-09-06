namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo {
    input: GetFooInput
}

structure GetFooInput {
    foo: TestUnion
}

union TestUnion {
    fooUser: User
}

structure User {
    firstname: String,
    lastname: String
}
