$version: "2.0"

namespace identity.auth.httpApiKeyAuth

use common#fakeProtocol

@fakeProtocol
@httpApiKeyAuth(scheme: "ApiKey", name: "Authorization", in: "header")
service HttpApiKeyAuthService {
    operations: [
        OnlyHttpApiKeyAuth
        OnlyHttpApiKeyAuthOptional
        SameAsService
    ]
}

@readonly
@http(method: "GET", uri: "/OnlyHttpApiKeyAuth")
@auth([httpApiKeyAuth])
operation OnlyHttpApiKeyAuth {}

@readonly
@http(method: "GET", uri: "/OnlyHttpApiKeyAuthOptional")
@auth([httpApiKeyAuth])
@optionalAuth
operation OnlyHttpApiKeyAuthOptional {}

@readonly
@http(method: "GET", uri: "/SameAsService")
operation SameAsService {}
