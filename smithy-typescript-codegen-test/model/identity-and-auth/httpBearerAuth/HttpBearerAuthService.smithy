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

@http(method: "GET", uri: "/OnlyHttpBearerAuth")
@auth([httpBearerAuth])
operation OnlyHttpBearerAuth {}

@http(method: "GET", uri: "/OnlyHttpBearerAuthOptional")
@auth([httpBearerAuth])
@optionalAuth
operation OnlyHttpBearerAuthOptional {}

@http(method: "GET", uri: "/SameAsService")
operation SameAsService {}
