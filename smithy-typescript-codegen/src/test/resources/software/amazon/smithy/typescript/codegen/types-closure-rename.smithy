$version: "2.0"

metadata shapeClosures = [
    {
        id: "smithy.example#types"
        includeNamespaces: ["smithy.example"]
        rename: {
            "smithy.example#Dimensions": "RenamedDimensions"
            "smithy.example#WidgetError": "RenamedWidgetError"
        }
    }
]

namespace smithy.example

structure Widget {
    id: String
    dimensions: Dimensions
    kind: WidgetKind
    problem: WidgetError
}

structure Dimensions {
    width: Integer
    height: Integer
}

@error("client")
structure WidgetError {
    message: String
}

enum WidgetKind {
    STANDARD
    DELUXE
}
