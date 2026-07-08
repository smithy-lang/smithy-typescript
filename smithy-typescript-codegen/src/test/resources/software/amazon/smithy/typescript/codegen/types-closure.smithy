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
    dimensions: Dimensions
    kind: WidgetKind
}

structure Dimensions {
    width: Integer
    height: Integer
}

enum WidgetKind {
    STANDARD
    DELUXE
}
