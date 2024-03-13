$version: "2.0"

namespace identity.auth.httpBearerAuth

use common#fakeProtocol

@fakeProtocol
@httpBearerAuth
service HttpBearerAuthService {
    operations: [
        OnlyHttpBearerAuth
        OnlyHttpBearerAuthOptional
        SameAsService
    ]
}

@readonly
@http(method: "GET", uri: "/OnlyHttpBearerAuth")
@auth([httpBearerAuth])
operation OnlyHttpBearerAuth {}

@readonly
@http(method: "GET", uri: "/OnlyHttpBearerAuthOptional")
@auth([httpBearerAuth])
@optionalAuth
operation OnlyHttpBearerAuthOptional {}

@readonly
@http(method: "GET", uri: "/SameAsService")
operation SameAsService {}
