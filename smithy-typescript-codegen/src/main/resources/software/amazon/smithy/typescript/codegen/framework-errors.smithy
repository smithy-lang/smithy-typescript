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

@error("client")
@httpError(415)
structure UnsupportedMediaTypeException {}

@error("client")
@httpError(406)
structure NotAcceptableException {}
