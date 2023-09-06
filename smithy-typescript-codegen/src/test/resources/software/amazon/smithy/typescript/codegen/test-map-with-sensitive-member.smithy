namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo {
    input: GetFooInput
}

structure GetFooInput {
    foo: PhoneNumbersMap
}

map PhoneNumbersMap {
    key: String,
    
    value: SensitiveString
}

@sensitive
string SensitiveString