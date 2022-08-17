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
    member: TestUnion
}

union TestUnion {
    bar: String,

    sensitiveBar: SensitiveString
}

@sensitive
string SensitiveString