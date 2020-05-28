namespace smithy.example

@protocols([{name: "aws.rest-json-1.1"}])
service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

operation GetFoo(GetFooInput)

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