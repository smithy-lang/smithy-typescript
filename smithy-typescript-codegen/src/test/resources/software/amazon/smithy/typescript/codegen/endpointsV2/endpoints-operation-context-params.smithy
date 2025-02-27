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
        opContextParamWildcardExpressionHash: {
            type: "stringArray",
        },
        opContextParamMultiSelectList: {
            type: "stringArray",
        },
        opContextParamMultiSelectListFlatten: {
            type: "stringArray",
        },
        opContextParamKeys: {
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
    "opContextParamWildcardExpressionHash": { path: "fooObjObj.*.bar" }
    "opContextParamMultiSelectList": { path: "fooListObjObj[*].[fooList[0], fooObject.bar, fooString]" }
    "opContextParamMultiSelectListFlatten": { path: "fooListObjObj[*].[fooList][]" }
    "opContextParamKeys": { path: "keys(fooKeys)" }
)
operation GetFoo {
    input: GetFooInput,
    output: GetFooOutput,
    errors: [GetFooError]
}

structure GetFooInput {
    fooKeys: FooObject,
    fooList: FooList,
    fooListObj: FooListObject,
    fooListObjObj: FooListObjectObject,
    fooObj: FooObject,
    fooObjObj: FooObjectObject,
    fooString: String,
}

structure FooObject {
    bar: String
}

list FooListObjectObject {
    member: FooMultiSelectObjectObject
}

structure FooMultiSelectObjectObject {
    fooList: FooList
    fooObject: FooObject
    fooString: String
}

structure FooObjectObject {
    baz: FooObject
}

list FooList {
    member: String
}

list FooListObject {
    member: FooListObjectMember
}

structure FooListObjectMember {
    key: String
}

structure GetFooOutput {}

@error("client")
structure GetFooError {}
