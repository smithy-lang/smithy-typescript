namespace smithy.framework

@error("server")
@httpError(500)
structure InternalFailure {}

@error("client")
@httpError(404)
structure UnknownOperationException {}

@error("client")
@httpError(400)
structure SerializationException {}
