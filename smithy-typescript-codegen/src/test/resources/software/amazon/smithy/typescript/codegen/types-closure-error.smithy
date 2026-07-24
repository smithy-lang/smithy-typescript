$version: "2.0"

metadata shapeClosures = [
    {
        id: "smithy.example#types"
        includeNamespaces: ["smithy.example"]
    }
]

namespace smithy.example

structure Widget {
    id: String
    problem: WidgetError
}

@error("client")
structure WidgetError {
    message: String
    reason: String
}
