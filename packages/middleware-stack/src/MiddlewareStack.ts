import type {
  AbsoluteLocation,
  DeserializeHandler,
  Handler,
  HandlerExecutionContext,
  HandlerOptions,
  MiddlewareStack,
  MiddlewareType,
  Pluggable,
  Priority,
  RelativeLocation,
  RelativeMiddlewareOptions,
  Step,
} from "@smithy/types";

import type { AbsoluteMiddlewareEntry, MiddlewareEntry, Normalized, RelativeMiddlewareEntry } from "./types";

const getAllAliases = (name: string | undefined, aliases: Array<string> | undefined) => {
  const _aliases = [];
  if (name) {
    _aliases.push(name);
  }
  if (aliases) {
    for (const alias of aliases) {
      _aliases.push(alias);
    }
  }
  return _aliases;
};

const getMiddlewareNameWithAliases = (name: string | undefined, aliases: Array<string> | undefined): string => {
  return `${name || "anonymous"}${aliases && aliases.length > 0 ? ` (a.k.a. ${aliases.join(",")})` : ""}`;
};

/**
 * @internal
 */
export const constructStack = <Input extends object, Output extends object>(): MiddlewareStack<Input, Output> => {
  let absoluteEntries: AbsoluteMiddlewareEntry<Input, Output>[] = [];
  let relativeEntries: RelativeMiddlewareEntry<Input, Output>[] = [];
  let identifyOnResolve = false;
  const entriesNameSet: Set<string> = new Set();
  let cachedMiddlewareList: Array<MiddlewareEntry<Input, Output>> | null = null;

  const invalidateCache = () => {
    cachedMiddlewareList = null;
  };

  const sort = <T extends AbsoluteMiddlewareEntry<Input, Output>>(entries: T[]): T[] =>
    entries.sort(
      (a, b) =>
        stepWeights[b.step] - stepWeights[a.step] ||
        priorityWeights[b.priority || "normal"] - priorityWeights[a.priority || "normal"]
    );

  const removeByName = (toRemove: string): boolean => {
    let isRemoved = false;
    const filterCb = (entry: MiddlewareEntry<Input, Output>): boolean => {
      const aliases = getAllAliases(entry.name, entry.aliases);
      if (aliases.includes(toRemove)) {
        isRemoved = true;
        for (const alias of aliases) {
          entriesNameSet.delete(alias);
        }
        return false;
      }
      return true;
    };
    absoluteEntries = absoluteEntries.filter(filterCb);
    relativeEntries = relativeEntries.filter(filterCb);
    if (isRemoved) invalidateCache();
    return isRemoved;
  };

  const removeByReference = (toRemove: MiddlewareType<Input, Output>): boolean => {
    let isRemoved = false;
    const filterCb = (entry: MiddlewareEntry<Input, Output>): boolean => {
      if (entry.middleware === toRemove) {
        isRemoved = true;
        for (const alias of getAllAliases(entry.name, entry.aliases)) {
          entriesNameSet.delete(alias);
        }
        return false;
      }
      return true;
    };
    absoluteEntries = absoluteEntries.filter(filterCb);
    relativeEntries = relativeEntries.filter(filterCb);
    if (isRemoved) invalidateCache();
    return isRemoved;
  };

  const cloneTo = <InputType extends Input, OutputType extends Output>(
    toStack: MiddlewareStack<InputType, OutputType>
  ): MiddlewareStack<InputType, OutputType> => {
    // Use internal bulk-add if available (same implementation), otherwise fall back
    // to public API for cross-version compatibility.
    if ("_addBulk" in toStack) {
      (toStack as any)._addBulk(absoluteEntries, relativeEntries);
    } else {
      absoluteEntries.forEach((entry) => {
        //@ts-ignore
        toStack.add(entry.middleware, { ...entry });
      });
      relativeEntries.forEach((entry) => {
        //@ts-ignore
        toStack.addRelativeTo(entry.middleware, { ...entry });
      });
    }
    toStack.identifyOnResolve?.(stack.identifyOnResolve());
    return toStack;
  };

  const expandRelativeMiddlewareList = (
    from: Normalized<MiddlewareEntry<Input, Output>, Input, Output>
  ): MiddlewareEntry<Input, Output>[] => {
    const expandedMiddlewareList: MiddlewareEntry<Input, Output>[] = [];
    from.before.forEach((entry) => {
      if (entry.before.length === 0 && entry.after.length === 0) {
        expandedMiddlewareList.push(entry);
      } else {
        expandedMiddlewareList.push(...expandRelativeMiddlewareList(entry));
      }
    });
    expandedMiddlewareList.push(from);
    for (let i = from.after.length - 1; i >= 0; i--) {
      const entry = from.after[i];
      if (entry.before.length === 0 && entry.after.length === 0) {
        expandedMiddlewareList.push(entry);
      } else {
        expandedMiddlewareList.push(...expandRelativeMiddlewareList(entry));
      }
    }
    return expandedMiddlewareList;
  };

  /**
   * Get a final list of middleware in the order of being executed in the resolved handler.
   * @param debug - don't throw, getting info only.
   */
  const getMiddlewareList = (debug = false): Array<MiddlewareEntry<Input, Output>> => {
    if (!debug && cachedMiddlewareList) {
      return [...cachedMiddlewareList];
    }

    const normalizedAbsoluteEntries: Normalized<AbsoluteMiddlewareEntry<Input, Output>, Input, Output>[] = [];
    const normalizedRelativeEntries: Normalized<RelativeMiddlewareEntry<Input, Output>, Input, Output>[] = [];
    const normalizedEntriesNameMap: Record<string, Normalized<MiddlewareEntry<Input, Output>, Input, Output>> = {};

    absoluteEntries.forEach((entry) => {
      const normalizedEntry = {
        ...entry,
        before: [],
        after: [],
      };
      for (const alias of getAllAliases(normalizedEntry.name, normalizedEntry.aliases)) {
        normalizedEntriesNameMap[alias] = normalizedEntry;
      }
      normalizedAbsoluteEntries.push(normalizedEntry);
    });

    relativeEntries.forEach((entry) => {
      const normalizedEntry = {
        ...entry,
        before: [],
        after: [],
      };
      for (const alias of getAllAliases(normalizedEntry.name, normalizedEntry.aliases)) {
        normalizedEntriesNameMap[alias] = normalizedEntry;
      }
      normalizedRelativeEntries.push(normalizedEntry);
    });

    normalizedRelativeEntries.forEach((entry) => {
      if (entry.toMiddleware) {
        const toMiddleware = normalizedEntriesNameMap[entry.toMiddleware];
        if (toMiddleware === undefined) {
          if (debug) {
            return;
          }
          throw new Error(
            `${entry.toMiddleware} is not found when adding ` +
              `${getMiddlewareNameWithAliases(entry.name, entry.aliases)} ` +
              `middleware ${entry.relation} ${entry.toMiddleware}`
          );
        }
        if (entry.relation === "after") {
          toMiddleware.after.push(entry);
        }
        if (entry.relation === "before") {
          toMiddleware.before.push(entry);
        }
      }
    });

    const mainChain = sort(normalizedAbsoluteEntries).flatMap(expandRelativeMiddlewareList);

    if (!debug) {
      cachedMiddlewareList = mainChain;
    }
    return mainChain;
  };

  const stack: MiddlewareStack<Input, Output> = {
    /**
     * @internal - Bulk-add entries from another stack. Used by cloneTo for performance.
     * Skips override logic but still checks for duplicate names to preserve correctness
     * when the target stack is non-empty (e.g. applyToStack on a populated stack).
     */
    _addBulk: (
      absEntries: AbsoluteMiddlewareEntry<Input, Output>[],
      relEntries: RelativeMiddlewareEntry<Input, Output>[]
    ) => {
      for (const entry of absEntries) {
        const aliases = getAllAliases(entry.name, entry.aliases);
        if (aliases.length > 0 && aliases.some((alias) => entriesNameSet.has(alias))) {
          // Fall back to the full add() path which handles override and error reporting.
          //@ts-ignore
          stack.add(entry.middleware, { ...entry });
          continue;
        }
        // Shallow copy to prevent mutation of source stack's entries.
        absoluteEntries.push({ ...entry });
        for (const alias of aliases) {
          entriesNameSet.add(alias);
        }
      }
      for (const entry of relEntries) {
        const aliases = getAllAliases(entry.name, entry.aliases);
        if (aliases.length > 0 && aliases.some((alias) => entriesNameSet.has(alias))) {
          //@ts-ignore
          stack.addRelativeTo(entry.middleware, { ...entry });
          continue;
        }
        relativeEntries.push({ ...entry });
        for (const alias of aliases) {
          entriesNameSet.add(alias);
        }
      }
      invalidateCache();
    },

    add: (middleware: MiddlewareType<Input, Output>, options: HandlerOptions & AbsoluteLocation = {}) => {
      const { name, override, aliases: _aliases } = options;
      const entry: AbsoluteMiddlewareEntry<Input, Output> = {
        step: "initialize",
        priority: "normal",
        middleware,
        ...options,
      };
      const aliases = getAllAliases(name, _aliases);
      if (aliases.length > 0) {
        if (aliases.some((alias) => entriesNameSet.has(alias))) {
          if (!override) throw new Error(`Duplicate middleware name '${getMiddlewareNameWithAliases(name, _aliases)}'`);
          for (const alias of aliases) {
            const toOverrideIndex = absoluteEntries.findIndex(
              (entry) => entry.name === alias || entry.aliases?.some((a) => a === alias)
            );
            if (toOverrideIndex === -1) {
              continue;
            }
            const toOverride = absoluteEntries[toOverrideIndex];
            if (toOverride.step !== entry.step || entry.priority !== toOverride.priority) {
              throw new Error(
                `"${getMiddlewareNameWithAliases(toOverride.name, toOverride.aliases)}" middleware with ` +
                  `${toOverride.priority} priority in ${toOverride.step} step cannot ` +
                  `be overridden by "${getMiddlewareNameWithAliases(name, _aliases)}" middleware with ` +
                  `${entry.priority} priority in ${entry.step} step.`
              );
            }
            absoluteEntries.splice(toOverrideIndex, 1);
          }
        }
        for (const alias of aliases) {
          entriesNameSet.add(alias);
        }
      }
      absoluteEntries.push(entry);
      invalidateCache();
    },

    addRelativeTo: (middleware: MiddlewareType<Input, Output>, options: HandlerOptions & RelativeLocation) => {
      const { name, override, aliases: _aliases } = options;
      const entry: RelativeMiddlewareEntry<Input, Output> = {
        middleware,
        ...options,
      };
      const aliases = getAllAliases(name, _aliases);
      if (aliases.length > 0) {
        if (aliases.some((alias) => entriesNameSet.has(alias))) {
          if (!override) throw new Error(`Duplicate middleware name '${getMiddlewareNameWithAliases(name, _aliases)}'`);
          for (const alias of aliases) {
            const toOverrideIndex = relativeEntries.findIndex(
              (entry) => entry.name === alias || entry.aliases?.some((a) => a === alias)
            );
            if (toOverrideIndex === -1) {
              continue;
            }
            const toOverride = relativeEntries[toOverrideIndex];
            if (toOverride.toMiddleware !== entry.toMiddleware || toOverride.relation !== entry.relation) {
              throw new Error(
                `"${getMiddlewareNameWithAliases(toOverride.name, toOverride.aliases)}" middleware ` +
                  `${toOverride.relation} "${toOverride.toMiddleware}" middleware cannot be overridden ` +
                  `by "${getMiddlewareNameWithAliases(name, _aliases)}" middleware ${entry.relation} ` +
                  `"${entry.toMiddleware}" middleware.`
              );
            }
            relativeEntries.splice(toOverrideIndex, 1);
          }
        }
        for (const alias of aliases) {
          entriesNameSet.add(alias);
        }
      }
      relativeEntries.push(entry);
      invalidateCache();
    },

    clone: () => cloneTo(constructStack<Input, Output>()),

    use: (plugin: Pluggable<Input, Output>) => {
      plugin.applyToStack(stack);
    },

    remove: (toRemove: MiddlewareType<Input, Output> | string): boolean => {
      if (typeof toRemove === "string") return removeByName(toRemove);
      else return removeByReference(toRemove);
    },

    removeByTag: (toRemove: string): boolean => {
      let isRemoved = false;
      const filterCb = (entry: MiddlewareEntry<Input, Output>): boolean => {
        const { tags, name, aliases: _aliases } = entry;
        if (tags && tags.includes(toRemove)) {
          const aliases = getAllAliases(name, _aliases);
          for (const alias of aliases) {
            entriesNameSet.delete(alias);
          }
          isRemoved = true;
          return false;
        }
        return true;
      };
      absoluteEntries = absoluteEntries.filter(filterCb);
      relativeEntries = relativeEntries.filter(filterCb);
      if (isRemoved) invalidateCache();
      return isRemoved;
    },

    concat: <InputType extends Input, OutputType extends Output>(
      from: MiddlewareStack<InputType, OutputType>
    ): MiddlewareStack<InputType, OutputType> => {
      const cloned = cloneTo(constructStack<InputType, OutputType>());
      cloned.use(from);
      cloned.identifyOnResolve(
        identifyOnResolve || cloned.identifyOnResolve() || (from.identifyOnResolve?.() ?? false)
      );
      return cloned;
    },

    applyToStack: cloneTo,

    identify: (): string[] => {
      return getMiddlewareList(true).map((mw: MiddlewareEntry<Input, Output>) => {
        const step =
          mw.step ??
          (mw as unknown as RelativeMiddlewareOptions).relation +
            " " +
            (mw as unknown as RelativeMiddlewareOptions).toMiddleware;
        return getMiddlewareNameWithAliases(mw.name, mw.aliases) + " - " + step;
      });
    },

    identifyOnResolve(toggle?: boolean) {
      if (typeof toggle === "boolean") identifyOnResolve = toggle;
      return identifyOnResolve;
    },

    resolve: <InputType extends Input, OutputType extends Output>(
      handler: DeserializeHandler<InputType, OutputType>,
      context: HandlerExecutionContext
    ): Handler<InputType, OutputType> => {
      const middlewareList = getMiddlewareList();
      for (let i = middlewareList.length - 1; i >= 0; i--) {
        handler = middlewareList[i].middleware(handler as Handler<Input, OutputType>, context) as any;
      }
      if (identifyOnResolve) {
        console.log(stack.identify());
      }
      return handler as Handler<InputType, OutputType>;
    },
  };
  return stack;
};

const stepWeights: { [key in Step]: number } = {
  initialize: 5,
  serialize: 4,
  build: 3,
  finalizeRequest: 2,
  deserialize: 1,
};

const priorityWeights: { [key in Priority]: number } = {
  high: 3,
  normal: 2,
  low: 1,
};
