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
)
operation GetFoo {
    input: GetFooInput,
    output: GetFooOutput,
    errors: [GetFooError]
}

structure GetFooInput {
    fooString: String,
    fooObj: FooObject
}

structure FooObject {
    bar: String
}

structure GetFooOutput {}

@error("client")
structure GetFooError {}
