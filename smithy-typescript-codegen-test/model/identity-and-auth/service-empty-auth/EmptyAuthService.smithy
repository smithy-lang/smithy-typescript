$version: "2.0"

namespace identity.auth.emptyAuth

use aws.auth#sigv4
use common#fakeProtocol
use common#fakeAuth

@fakeProtocol
@sigv4(name: "weather")
@fakeAuth
@httpApiKeyAuth(name: "X-Api-Key", in: "header")
@httpBearerAuth
// Empty @auth trait applied
@auth([])
service EmptyAuthService {
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

@http(method: "GET", uri: "/SameAsServiceOptional")
@optionalAuth
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
