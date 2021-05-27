namespace software.amazon.smithy.typescript.integ

use aws.protocols#restJson1

@restJson1
service CustomValidation {
    version: "2020-01-25",
    operations: [Test]
}

@readonly
@http(method: "POST", uri:"/test")
operation Test {
    input: TestInput,
    errors: [CustomValidationError]
}

structure TestInput {
    enumList: ListOfEnums
}

@enum([{"value" : "valueA"}, {"value": "valueB"}])
string Enum

@length(max: 2)
list ListOfEnums {
    member: Enum
}

@error("client")
structure CustomValidationError {
    failingPaths: StringList,
    totalFailures: Integer
}

list StringList {
    member: String
}
