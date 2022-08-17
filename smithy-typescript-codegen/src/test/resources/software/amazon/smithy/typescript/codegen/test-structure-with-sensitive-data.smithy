namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo {
    input: GetFooInput
}

structure GetFooInput {
    foo: User
}

structure User {
    username: String,

    password: SensitiveString
}

@sensitive
string SensitiveString