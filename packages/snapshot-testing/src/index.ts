export { SnapshotRunner } from "./SnapshotRunner";
export { customFields } from "./structure/createFromSchema";

/**
 * Extend this to create additional snapshot response serializers.
 *
 * @internal
 */
export { SnapshotProtocol } from "./protocols/SnapshotProtocol";

/**
 * Add additional SnapshotProtocol to this object, key by protocol ShapeId.
 * @internal
 */
export { snapshotTestingProtocolResponseSerializers } from "./protocols/index";
