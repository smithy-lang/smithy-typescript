namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo {
    input: GetFooInput
}

structure GetFooInput {
    foo: UserList
}

list UserList {
    member: User
}

structure User {
    username: String,

    @sensitive
    password: String
}
