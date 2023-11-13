$version: "2.0"

namespace identity.auth.specifiedAuth

use aws.auth#sigv4
use common#fakeProtocol
use common#fakeAuth

@fakeProtocol
@sigv4(name: "weather")
@fakeAuth
@httpApiKeyAuth(name: "X-Api-Key", in: "header")
@httpBearerAuth
// Specific @auth trait specified; in this cases, uses the reverse of default auth order (reverse sorted by ShapeId)
@auth([httpBearerAuth, httpApiKeyAuth, fakeAuth, sigv4])
service SpecifiedAuthService {
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

@auth([sigv4, fakeAuth, httpApiKeyAuth, httpBearerAuth])
@http(method: "GET", uri: "/OperationAuthTrait")
operation OperationAuthTrait {}

@auth([sigv4, fakeAuth, httpApiKeyAuth, httpBearerAuth])
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
