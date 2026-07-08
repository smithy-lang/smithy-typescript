$version: "2.0"

metadata shapeClosures = [
    {
        id: "example.types#typesClosure"
        includeNamespaces: ["example.types"]
    }
]

namespace example.types

/// A standalone data shape generated in types-only mode.
structure Bird {
    name: String
    scientificClassification: ScientificClassification
    measurements: BirdMeasurements
    conservationStatus: ConservationStatus
    tags: BirdTagList
    nest: Nest
    problem: BirdError
}

structure ScientificClassification {
    order: String
    family: String
    genus: String
    species: String
}

structure BirdMeasurements {
    minWingspanCm: Integer
    maxWingspanCm: Integer
    minLengthCm: Integer
    maxLengthCm: Integer
    minWeightGrams: Integer
    maxWeightGrams: Integer
}

enum ConservationStatus {
    LEAST_CONCERN
    NEAR_THREATENED
    VULNERABLE
    ENDANGERED
}

union Nest {
    openCup: OpenCupNest
    cavity: CavityNest
    ground: GroundNest
}

structure OpenCupNest {
    placement: String
    primaryMaterial: String
    liningMaterial: String
}

structure CavityNest {
    substrate: String
    entranceDiameterCm: Integer
    depthCm: Integer
}

structure GroundNest {
    habitat: String
    concealed: Boolean
}

/// Error shapes in a closure generate throwable classes extending the
/// generic ServiceException base, since types mode has no service.
@error("client")
structure BirdError {
    message: String
    reason: String
}

list BirdTagList {
    member: String
}
