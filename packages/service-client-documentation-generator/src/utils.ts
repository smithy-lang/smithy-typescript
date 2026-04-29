import { sep } from "node:path";
import type { Reflection } from "typedoc";

/**
 * @internal
 */
export const isClientModel = (model: Reflection | undefined) =>
  model?.sources?.[0]?.fullFileName.includes(`${sep}clients${sep}`);
