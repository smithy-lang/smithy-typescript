import { SmithyRpcV2CborSnapshotProtocol } from "./SmithyRpcV2CborSnapshotProtocol";
import type { SnapshotProtocol } from "./SnapshotProtocol";

const smithyRpcV2CborSnapshotProtocol = new SmithyRpcV2CborSnapshotProtocol();

/**
 * @internal
 */
export const snapshotTestingProtocolResponseSerializers = {
  [smithyRpcV2CborSnapshotProtocol.getShapeId()]: smithyRpcV2CborSnapshotProtocol,
} as Record<string, SnapshotProtocol>;
