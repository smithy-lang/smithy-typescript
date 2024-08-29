$version: "2.0"

namespace smithy.example

@smithy.rules#endpointRuleSet({
    version: "1.0",
    parameters: {
        opContextParamIdentifier: {
            type: "string",
        },
        opContextParamSubExpression: {
            type: "string",
        },
        opContextParamWildcardExpressionList: {
            type: "stringArray",
        },
        opContextParamWildcardExpressionListObj: {
            type: "stringArray",
        },
    },
    rules: []
})
service Example {
    version: "1.0.0",
    operations: [GetFoo]
}

@smithy.rules#operationContextParams(
    "opContextParamIdentifier": { path: "fooString" }
    "opContextParamSubExpression": { path: "fooObj.bar" }
    "opContextParamWildcardExpressionList": { path: "fooList[*]" }
    "opContextParamWildcardExpressionListObj": { path: "fooListObj[*].key" }
)
operation GetFoo {
    input: GetFooInput,
    output: GetFooOutput,
    errors: [GetFooError]
}

structure GetFooInput {
    fooString: String,
    fooObj: FooObject,
    fooList: FooList,
    fooListObj: FooListObj,
}

structure FooObject {
    bar: String
}

list FooList {
    member: String
}

list FooListObj {
    member: FooListObjMember
}

structure FooListObjMember {
    key: String
}

structure GetFooOutput {}

@error("client")
structure GetFooError {}
