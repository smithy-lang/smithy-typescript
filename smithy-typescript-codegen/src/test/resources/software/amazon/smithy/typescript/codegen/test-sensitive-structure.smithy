namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo {
    input: GetFooInput
}

structure GetFooInput {
    foo: SecretUser
}

@sensitive
structure SecretUser {
    firstname: String,
    lastname: String
}
