$version: "2.0"

namespace smithy.example

use smithy.protocols#rpcv2Cbor

@rpcv2Cbor
service Example {
    version: "1.0.0"
    operations: [Publish]
}

operation Publish {
    input: PublishInput
    output: PublishOutput
}

structure PublishInput {
    events: PublishEvents
}

structure PublishOutput {
    events: PublishEvents
}

@streaming
union PublishEvents {
    message: MessageEvent
    leave: LeaveEvent
}

structure MessageEvent {
    message: String
}

structure LeaveEvent {}
