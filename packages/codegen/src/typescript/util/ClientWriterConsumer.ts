import type { ClientBodyExtraCodeSection } from "../sections/ClientBodyExtraCodeSection";
import type { TypeScriptWriter } from "../TypeScriptWriter";

/**
 * Adds imports and dependencies used by a RuntimeClientPlugin at the client level.
 *
 * @internal
 */
export type ClientWriterConsumer = (writer: TypeScriptWriter, section: ClientBodyExtraCodeSection) => void;
