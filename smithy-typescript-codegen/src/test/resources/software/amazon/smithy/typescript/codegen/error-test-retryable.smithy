namespace smithy.example

@protocols([{name: "aws.rest-json-1.1"}])
service Example {
    version: "1.0.0",
    operations: [DoSomething]
}

operation DoSomething() errors [Err]

@error("client")
@retryable
structure Err {}
