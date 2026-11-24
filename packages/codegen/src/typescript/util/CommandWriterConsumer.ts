import type { CommandConstructorCodeSection } from "../sections/CommandConstructorCodeSection";
import type { TypeScriptWriter } from "../TypeScriptWriter";

/**
 * Adds imports and dependencies used by a RuntimeClientPlugin at the command level.
 *
 * @internal
 */
export type CommandWriterConsumer = (writer: TypeScriptWriter, section: CommandConstructorCodeSection) => void;
