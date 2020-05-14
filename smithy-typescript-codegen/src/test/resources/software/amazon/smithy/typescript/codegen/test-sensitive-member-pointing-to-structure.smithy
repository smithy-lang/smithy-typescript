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
    sensitiveFoo: User
}

structure User {
    firstname: String,
    lastname: String
}
