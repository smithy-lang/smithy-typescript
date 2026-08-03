$version: "2.0"

namespace smithy.example

use smithy.typescript.protocols#sseJson

@sseJson
service Example {
    version: "1.0.0"
    operations: [Publish]
}

@http(method: "POST", uri: "/publish")
operation Publish {
    input: PublishInput
    output: PublishOutput
}

structure PublishInput {
    room: String
}

structure PublishOutput {
    @httpPayload
    events: PublishEvents
}

@streaming
union PublishEvents {
    message: MessageEvent
    leave: LeaveEvent
}

structure MessageEvent {
    text: String
}

structure LeaveEvent {}
