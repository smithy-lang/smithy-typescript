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
    recursiveUser: User,
    recursiveList: UsersList,
    recursiveMap: UsersMap
}

list UsersList {
    member: User
}

map UsersMap {
    key: String,
    value: User
}
