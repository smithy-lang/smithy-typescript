$version: "2.0"

namespace org.xyz.secondary

use smithy.protocols#rpcv2Cbor
use smithy.test#httpResponseTests

@httpResponseTests([
    {
        id: "HttpLabelCommandExample"
        protocol: rpcv2Cbor
        code: 200
        headers: { "smithy-protocol": "rpc-v2-cbor" }
    }
])
@http(method: "POST", uri: "/{LabelDoesNotApplyToRpcProtocol}", code: 200)
operation HttpLabelCommand {
    input := {
        @httpLabel
        @required
        LabelDoesNotApplyToRpcProtocol: String
    }

    output := {}
}
