$version: "2.0"

namespace foo.bar

string SimpleString

list SimpleList {
    member: A
}

map SimpleMap {
    key: A
    value: A
}

structure SimpleStruct {
    a: A
}

boolean Boolean

byte Byte

enum Enum {
    A
}

integer Integer

intEnum IntEnum {
    A = 1
}

long Long

short Short

bigDecimal BigDecimal

bigInteger BigInteger

blob Blob

timestamp Timestamp

document Document

double Double

float Float

list BigDecimalList {
    member: BigDecimal
}

list BigIntegerList {
    member: BigInteger
}

list BlobList {
    member: Blob
}

list DocumentList {
    member: Document
}

list TimestampList {
    member: Timestamp
}

list DoubleList {
    member: Double
}

list FloatList {
    member: Float
}

structure BigDecimalStructure {
    member: BigDecimal
}

structure BigIntegerStructure {
    member: BigInteger
}

structure BlobStructure {
    member: Blob
}

structure DocumentStructure {
    member: Document
}

structure TimestampStructure {
    member: Timestamp
}

structure DoubleStructure {
    member: Double
}

structure FloatStructure {
    member: Float
}

union BigDecimalUnion {
    member: BigDecimal
}

union BigIntegerUnion {
    member: BigInteger
}

union BlobUnion {
    member: Blob
}

union DocumentUnion {
    member: Document
}

union TimestampUnion {
    member: Timestamp
}

union DoubleUnion {
    member: Double
}

union FloatUnion {
    member: Float
}

map BigDecimalMap {
    key: String
    value: BigDecimal
}

map BigIntegerMap {
    key: String
    value: BigInteger
}

map BlobMap {
    key: String
    value: Blob
}

map DocumentMap {
    key: String
    value: Document
}

map TimestampMap {
    key: String
    value: Timestamp
}

map DoubleMap {
    key: String
    value: Double
}

map FloatMap {
    key: String
    value: Float
}

structure NestedJsonName {
    bar: JsonNameStructure
}

structure JsonNameStructure {
    @jsonName("foo")
    foo: A
}

structure NestedEventStream {
    eventStream: EventStreamUnion
}

@streaming
union EventStreamUnion {
    message: Event
}

structure Event {}

structure NestedMediaType {
    foo: MediaTypeString
}

@mediaType("video/quicktime")
string MediaTypeString

structure NestedSparseList {
    foo: SparseList
}

@sparse
list SparseList {
    member: String
}

structure NestedSparseMap {
    foo: SparseMap
}

@sparse
map SparseMap {
    key: String
    value: String
}

structure NestedIdempotencyToken {
    foo: IdempotencyTokenStructure
}

structure IdempotencyTokenStructure {
    @idempotencyToken
    foo: String
}

string A
