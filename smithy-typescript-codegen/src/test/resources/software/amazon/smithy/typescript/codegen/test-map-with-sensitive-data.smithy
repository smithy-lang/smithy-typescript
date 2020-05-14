namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo {
    input: GetFooInput
}

structure GetFooInput {
    foo: UserMap
}

map UserMap {
    key: String,
    value: User
}

structure User {
    username: String,

    @sensitive
    password: String
}
