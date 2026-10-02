import { SmithyRpcV2CborSnapshotProtocol } from "./SmithyRpcV2CborSnapshotProtocol";
import { SmithyRpcV2JsonSnapshotProtocol } from "./SmithyRpcV2JsonSnapshotProtocol";
import type { SnapshotProtocol } from "./SnapshotProtocol";

const smithyRpcV2CborSnapshotProtocol = new SmithyRpcV2CborSnapshotProtocol();
const smithyRpcV2JsonSnapshotProtocol = new SmithyRpcV2JsonSnapshotProtocol();

/**
 * @internal
 */
export const snapshotTestingProtocolResponseSerializers = {
  [smithyRpcV2CborSnapshotProtocol.getShapeId()]: smithyRpcV2CborSnapshotProtocol,
  [smithyRpcV2JsonSnapshotProtocol.getShapeId()]: smithyRpcV2JsonSnapshotProtocol,
} as Record<string, SnapshotProtocol>;
