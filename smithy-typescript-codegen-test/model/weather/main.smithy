$version: "2.0"

metadata suppressions = [
    {
        id: "UnstableTrait.smithy"
        namespace: "example.weather"
        reason: "Unstable traits are expected in test model, do not emit warning on them."
    }
]

namespace example.weather

use aws.auth#sigv4
use smithy.test#httpRequestTests
use smithy.test#httpResponseTests
use smithy.waiters#waitable
use common#fakeProtocol
use common#fakeAuth

/// Provides weather forecasts.
@fakeProtocol
@httpApiKeyAuth(name: "X-Api-Key", in: "header")
@httpBearerAuth
@sigv4(name: "weather")
@fakeAuth
@auth([sigv4])
@paginated(inputToken: "nextToken", outputToken: "nextToken", pageSize: "pageSize")
service Weather {
    version: "2006-03-01"
    resources: [City]
    operations: [
        GetCurrentTime
        // util-stream.integ.spec.ts
        Invoke
        // experimentalIdentityAndAuth
        OnlyHttpApiKeyAuth
        OnlyHttpApiKeyAuthOptional
        OnlyHttpBearerAuth
        OnlyHttpBearerAuthOptional
        OnlyHttpApiKeyAndBearerAuth
        OnlyHttpApiKeyAndBearerAuthReversed
        OnlySigv4Auth
        OnlySigv4AuthOptional
        OnlyFakeAuth
        OnlyFakeAuthOptional
        SameAsService
    ]
}

@readonly
@http(method: "GET", uri: "/OnlyHttpApiKeyAuth")
@auth([httpApiKeyAuth])
operation OnlyHttpApiKeyAuth {}

@readonly
@http(method: "GET", uri: "/OnlyHttpBearerAuth")
@auth([httpBearerAuth])
operation OnlyHttpBearerAuth {}

@readonly
@http(method: "GET", uri: "/OnlySigv4Auth")
@auth([sigv4])
operation OnlySigv4Auth {}

@readonly
@http(method: "GET", uri: "/OnlyHttpApiKeyAndBearerAuth")
@auth([httpApiKeyAuth, httpBearerAuth])
operation OnlyHttpApiKeyAndBearerAuth {}

@readonly
@http(method: "GET", uri: "/OnlyHttpApiKeyAndBearerAuthReversed")
@auth([httpBearerAuth, httpApiKeyAuth])
operation OnlyHttpApiKeyAndBearerAuthReversed {}

@readonly
@http(method: "GET", uri: "/OnlyHttpApiKeyAuthOptional")
@auth([httpApiKeyAuth])
@optionalAuth
operation OnlyHttpApiKeyAuthOptional {}

@readonly
@http(method: "GET", uri: "/OnlyHttpBearerAuthOptional")
@auth([httpBearerAuth])
@optionalAuth
operation OnlyHttpBearerAuthOptional {}

@readonly
@http(method: "GET", uri: "/OnlySigv4AuthOptional")
@auth([sigv4])
@optionalAuth
operation OnlySigv4AuthOptional {}

@readonly
@http(method: "GET", uri: "/OnlyFakeAuth")
@auth([fakeAuth])
operation OnlyFakeAuth {}

@readonly
@http(method: "GET", uri: "/OnlyFakeAuthOptional")
@auth([fakeAuth])
@optionalAuth
operation OnlyFakeAuthOptional {}

@readonly
@http(method: "GET", uri: "/SameAsService")
operation SameAsService {}

resource City {
    identifiers: {cityId: CityId}
    create: CreateCity
    read: GetCity
    list: ListCities
    resources: [Forecast, CityImage]
    operations: [GetCityAnnouncements]
}

resource Forecast {
    identifiers: {cityId: CityId}
    read: GetForecast
}

resource CityImage {
    identifiers: {cityId: CityId}
    read: GetCityImage
}

// "pattern" is a trait.
@pattern("^[A-Za-z0-9 ]+$")
string CityId

@readonly
@http(method: "GET", uri: "/cities/{cityId}")
@httpChecksumRequired
operation GetCity {
    input: GetCityInput
    output: GetCityOutput
    errors: [NoSuchResource]
}

// Tests that HTTP protocol tests are generated.
apply GetCity @httpRequestTests(
    [
        {
            id: "WriteGetCityAssertions"
            documentation: "Does something"
            protocol: "common#fakeProtocol"
            method: "GET"
            uri: "/cities/123"
            body: ""
            params: {cityId: "123"}
        }
    ]
)

apply GetCity @httpResponseTests(
    [
        {
            id: "WriteGetCityResponseAssertions"
            documentation: "Does something"
            protocol: "common#fakeProtocol"
            code: 200
            body: """
            {
                "name": "Seattle",
                "coordinates": {
                    "latitude": 12.34,
                    "longitude": -56.78
                },
                "city": {
                    "cityId": "123",
                    "name": "Seattle",
                    "number": "One",
                    "case": "Upper"
                }
            }"""
            bodyMediaType: "application/json"
            params: {
                name: "Seattle"
                coordinates: {latitude: 12.34, longitude: -56.78}
                city: {cityId: "123", name: "Seattle", number: "One", case: "Upper"}
            }
        }
    ]
)

/// The input used to get a city.
structure GetCityInput {
    // "cityId" provides the identifier for the resource and
    // has to be marked as required.
    @required
    @httpLabel
    cityId: CityId
}

structure GetCityOutput {
    // "required" is used on output to indicate if the service
    // will always provide a value for the member.
    @required
    name: String

    @required
    coordinates: CityCoordinates

    city: CitySummary
}

@idempotent
@http(method: "PUT", uri: "/city")
operation CreateCity {
    input: CreateCityInput
    output: CreateCityOutput
}

structure CreateCityInput {
    @required
    name: String

    @required
    coordinates: CityCoordinates

    city: CitySummary
}

structure CreateCityOutput {
    @required
    cityId: CityId
}

// This structure is nested within GetCityOutput.
structure CityCoordinates {
    @required
    latitude: Float

    @required
    longitude: Float
}

/// Error encountered when no resource could be found.
@error("client")
@httpError(404)
structure NoSuchResource {
    /// The type of resource that was not found.
    @required
    resourceType: String

    message: String
}

apply NoSuchResource @httpResponseTests(
    [
        {
            id: "WriteNoSuchResourceAssertions"
            documentation: "Does something"
            protocol: "common#fakeProtocol"
            code: 404
            body: """
            {
                "resourceType": "City",
                "message": "Your custom message"
            }"""
            bodyMediaType: "application/json"
            params: {resourceType: "City", message: "Your custom message"}
        }
    ]
)

// The paginated trait indicates that the operation may
// return truncated results.
@readonly
@paginated(items: "items")
@http(method: "GET", uri: "/cities")
@waitable(
    CitiesExist: {
        acceptors: [
            {
                state: "success"
                matcher: {
                    output: {path: "length(items[]) > `0`", comparator: "booleanEquals", expected: "true"}
                }
            }
            {
                state: "failure"
                matcher: {errorType: "NoSuchResource"}
            }
        ]
    }
)
operation ListCities {
    input: ListCitiesInput
    output: ListCitiesOutput
    errors: [NoSuchResource]
}

apply ListCities @httpRequestTests(
    [
        {
            id: "WriteListCitiesAssertions"
            documentation: "Does something"
            protocol: "common#fakeProtocol"
            method: "GET"
            uri: "/cities"
            body: ""
            queryParams: ["pageSize=50"]
            forbidQueryParams: ["nextToken"]
            params: {pageSize: 50}
        }
    ]
)

structure ListCitiesInput {
    @httpQuery("nextToken")
    nextToken: String

    @httpQuery("pageSize")
    pageSize: Integer
}

structure ListCitiesOutput {
    nextToken: String

    @required
    items: CitySummaries
}

// CitySummaries is a list of CitySummary structures.
list CitySummaries {
    member: CitySummary
}

// CitySummary contains a reference to a City.
@references(
    [
        {resource: City}
    ]
)
structure CitySummary {
    @required
    cityId: CityId

    @required
    name: String

    number: String

    case: String
}

@readonly
@http(method: "GET", uri: "/current-time")
operation GetCurrentTime {
    output: GetCurrentTimeOutput
}

structure GetCurrentTimeOutput {
    @required
    time: Timestamp
}

@http(method: "POST", uri: "/invoke", code: 200)
operation Invoke {
    input: InvokeInput
    output: InvokeOutput
}

structure InvokeInput {
    @httpPayload
    payload: Blob
}

structure InvokeOutput {
    @httpPayload
    payload: Blob
}

@readonly
@http(method: "GET", uri: "/cities/{cityId}/forecast")
operation GetForecast {
    input: GetForecastInput
    output: GetForecastOutput
}

// "cityId" provides the only identifier for the resource since
// a Forecast doesn't have its own.
structure GetForecastInput {
    @required
    @httpLabel
    cityId: CityId
}

structure GetForecastOutput {
    chanceOfRain: Float
    precipitation: Precipitation
}

union Precipitation {
    rain: PrimitiveBoolean
    sleet: PrimitiveBoolean
    hail: StringMap
    snow: SimpleYesNo
    mixed: TypedYesNo
    other: OtherStructure
    blob: Blob
    foo: example.weather.nested#Foo
    baz: example.weather.nested.more#Baz
}

structure OtherStructure {}

enum SimpleYesNo {
    YES
    NO
}

enum TypedYesNo {
    YES = "YES"
    NO = "NO"
}

map StringMap {
    key: String
    value: String
}

@readonly
@http(method: "GET", uri: "/cities/{cityId}/image")
operation GetCityImage {
    input: GetCityImageInput
    output: GetCityImageOutput
    errors: [NoSuchResource]
}

structure GetCityImageInput {
    @required
    @httpLabel
    cityId: CityId
}

structure GetCityImageOutput {
    @httpPayload
    @required
    image: CityImageData
}

@streaming
blob CityImageData

@readonly
@http(method: "GET", uri: "/cities/{cityId}/announcements")
@tags(["client-only"])
operation GetCityAnnouncements {
    input: GetCityAnnouncementsInput
    output: GetCityAnnouncementsOutput
    errors: [NoSuchResource]
}

structure GetCityAnnouncementsInput {
    @required
    @httpLabel
    cityId: CityId
}

structure GetCityAnnouncementsOutput {
    @httpHeader("x-last-updated")
    lastUpdated: Timestamp

    @httpPayload
    announcements: Announcements
}

@streaming
union Announcements {
    police: Message
    fire: Message
    health: Message
}

structure Message {
    message: String
    author: String
}

apply Weather @smithy.rules#endpointRuleSet({
  "version": "1.3",
  "parameters": {
    "Region": {
      "required": true,
      "type": "String",
      "documentation": "docs"
    }
  },
  "rules": [
    {
      "conditions": [],
      "documentation": "base rule",
      "endpoint": {
        "url": "https://{Region}.amazonaws.com",
        "properties": {},
        "headers": {}
      },
      "type": "endpoint"
    }
  ]
})

apply Weather @smithy.rules#clientContextParams(
  Region: {type: "string", documentation: "docs"}
)
