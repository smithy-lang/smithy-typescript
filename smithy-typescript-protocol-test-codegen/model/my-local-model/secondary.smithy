$version: "2.0"

namespace org.xyz.secondary

use smithy.protocols#rpcv2Cbor

@rpcv2Cbor
@documentation("a second service in the same model, unused.")
service TertiaryService {
    version: "1.0"
    operations: [
        TertiaryUnusedOperation
    ]
    errors: [
        TertiaryUnusedServiceLinkedError
    ]
}

operation TertiaryUnusedOperation {
    input: Unit
    output: Unit
    errors: [
        TertiaryUnusedServiceOperationLinkedError
    ]
}

@error("client")
@httpError(400)
structure TertiaryUnusedServiceOperationLinkedError {}

@error("client")
@httpError(400)
structure TertiaryUnusedServiceLinkedError {}

@error("client")
@httpError(400)
structure TertiaryCompletelyUnlinkedError {}
