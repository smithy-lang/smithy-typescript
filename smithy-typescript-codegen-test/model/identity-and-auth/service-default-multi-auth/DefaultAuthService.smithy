$version: "2.0"

namespace identity.auth.defaultAuth

use aws.auth#sigv4
use common#fakeProtocol
use common#fakeAuth

@fakeProtocol
@sigv4(name: "weather")
@fakeAuth
@httpApiKeyAuth(name: "X-Api-Key", in: "header")
@httpBearerAuth
// No @auth trait applied, uses default auth order (sorted by ShapeId)
service DefaultAuthService {
    operations: [
        SameAsService
        SameAsServiceOptional
        OperationAuthTrait
        OperationAuthTraitOptional
        OperationEmptyAuthTrait
        OperationEmptyAuthTraitOptional
    ]
}

@http(method: "GET", uri: "/SameAsService")
operation SameAsService {}

@optionalAuth
@http(method: "GET", uri: "/SameAsServiceOptional")
operation SameAsServiceOptional {}

@auth([httpBearerAuth, httpApiKeyAuth, fakeAuth, sigv4])
@http(method: "GET", uri: "/OperationAuthTrait")
operation OperationAuthTrait {}

@auth([httpBearerAuth, httpApiKeyAuth, fakeAuth, sigv4])
@optionalAuth
@http(method: "GET", uri: "/OperationAuthTraitOptional")
operation OperationAuthTraitOptional {}

@auth([])
@http(method: "GET", uri: "/OperationEmptyAuthTrait")
operation OperationEmptyAuthTrait {}

@auth([])
@optionalAuth
@http(method: "GET", uri: "/OperationEmptyAuthTraitOptional")
operation OperationEmptyAuthTraitOptional {}
