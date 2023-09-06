namespace smithy.example

service Example {
    version: "1.0.0",
    operations: [ExampleOperation]
}

operation ExampleOperation {
    input: ExampleOperationInput
}

structure ExampleOperationInput {
    longInput: Long
}
