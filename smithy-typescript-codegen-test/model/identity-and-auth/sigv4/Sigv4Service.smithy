$version: "2.0"

namespace identity.auth.sigv4

use aws.auth#sigv4
use common#fakeProtocol

@fakeProtocol
@sigv4(name: "weather")
service Sigv4Service {
    operations: [
        OnlySigv4Auth
        OnlySigv4AuthOptional
        SameAsService
    ]
}

@http(method: "GET", uri: "/OnlySigv4Auth")
@auth([sigv4])
operation OnlySigv4Auth {}

@http(method: "GET", uri: "/OnlySigv4AuthOptional")
@auth([sigv4])
@optionalAuth
operation OnlySigv4AuthOptional {}

@http(method: "GET", uri: "/SameAsService")
operation SameAsService {}
