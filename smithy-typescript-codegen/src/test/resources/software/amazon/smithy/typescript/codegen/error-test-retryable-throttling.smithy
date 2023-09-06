namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [DoSomething]
}

operation DoSomething {
    errors: [Err]
}

@error("client")
@retryable(throttling: true)
structure Err {}
