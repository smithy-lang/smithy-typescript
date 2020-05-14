namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo {
    input: GetFooInput
}

structure GetFooInput {
    foo: SecretNamesMap
}

@sensitive
map SecretNamesMap {
    key: String,
    value: String
}
