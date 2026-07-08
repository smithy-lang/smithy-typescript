$version: "2.0"

metadata shapeClosures = [
    {
        id: "smithy.example#types"
        includeNamespaces: ["smithy.a", "smithy.b"]
    }
]

namespace smithy.a

structure Widget {
    id: String
    aOnly: String
}
