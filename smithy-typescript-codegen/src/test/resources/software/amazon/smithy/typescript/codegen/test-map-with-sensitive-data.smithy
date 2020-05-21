namespace smithy.example

@protocols([{name: "aws.rest-json-1.1"}])
service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo(GetFooInput)

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