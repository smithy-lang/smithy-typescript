namespace software.amazon.smithy.typescript.integ

use aws.protocols#restJson1

@restJson1
service ValidationService {
    version: "2020-01-25",
    operations: [Test]
}

@readonly
@http(method: "POST", uri:"/test")
operation Test {
    input: TestInput,
    errors: [ smithy.framework#ValidationException ]
}

structure TestInput {
    enum: Enum,
    enumList: ListOfEnums,
    enumMap: MapOfEnums,
    lengthTests: LengthTests,
    nestedTests: NestedUnionOne,
    recursiveTests: RecursiveStructureOne,
}

structure RecursiveStructureOne {
    member: RecursiveStructureTwo
}

structure RecursiveStructureTwo {
    member: RecursiveStructureOne
}

structure LengthTests {
    minMaxLengthString: MinMaxLengthString,

    minMaxLengthList: MinMaxLengthList,

    minMaxLengthMap: MinMaxLengthMap,

    minMaxLengthBlob: MinMaxLengthBlob,

    @length(min:13, max:27)
    minMaxLengthOverride: MinMaxLengthString,
}

union NestedUnionOne {
    value1: NestedUnionTwo
}

union NestedUnionTwo {
    value2: SetOfStructures
}

set SetOfStructures {
    member: NestedStructureOne
}

structure NestedStructureOne {
    unions: ListOfUnions
}

list ListOfUnions {
    member: NestedUnionThree
}

union NestedUnionThree {
    value3: MinMaxLengthString
}

@enum([{"value" : "valueA"}, {"value": "valueB"}])
string Enum

list ListOfEnums {
    member: Enum
}

map MapOfEnums {
    key: String,
    value: Enum,
}

@length(min: 2, max: 7)
string MinMaxLengthString

@length(min: 2, max: 4)
map MinMaxLengthMap {
    key: MinMaxLengthString,

    @range(min: 1, max: 7)
    value: Integer
}

@length(min: 2, max: 4)
list MinMaxLengthList {
    member: MinMaxLengthString
}

@length(min: 2, max: 4)
blob MinMaxLengthBlob
