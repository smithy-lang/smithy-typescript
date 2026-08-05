$version: "2.0"

namespace smithy.example

@trait(selector: "service")
@protocolDefinition
structure fakeProtocol {}

@fakeProtocol
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
    @httpPayload
    events: PublishEvents
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
    message: String
}

structure LeaveEvent {}
