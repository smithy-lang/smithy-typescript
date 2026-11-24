import type { TypeScriptIntegration } from "./TypeScriptIntegration";

/**
 * Orders integrations by runBefore/runAfter constraints, then by descending priority, then by registration order.
 */
export function sortIntegrations(integrations: TypeScriptIntegration[]): TypeScriptIntegration[] {
  const lookup = new Map<string, TypeScriptIntegration>();
  const insertionOrder = new Map<string, number>();
  const dependencies = new Map<string, Set<string>>();

  for (const integration of integrations) {
    const name = integration.name();
    if (lookup.has(name)) {
      throw new Error(`Conflicting SmithyIntegration names detected for '${name}'`);
    }
    lookup.set(name, integration);
    insertionOrder.set(name, insertionOrder.size);
    dependencies.set(name, new Set());
  }
  const dependenciesOf = (name: string): Set<string> => {
    let set = dependencies.get(name);
    if (set === undefined) {
      set = new Set();
      dependencies.set(name, set);
    }
    return set;
  };
  for (const integration of integrations) {
    const name = integration.name();
    for (const after of integration.runAfter()) {
      dependenciesOf(name).add(after);
      dependenciesOf(after);
    }
    for (const dependant of integration.runBefore()) {
      dependenciesOf(dependant).add(name);
      dependenciesOf(name);
    }
  }

  const compare = (left: string, right: string): number => {
    const l = lookup.get(left);
    const r = lookup.get(right);
    if (l === undefined || r === undefined) {
      return 0;
    }
    const byPriority = r.priority() - l.priority();
    return byPriority === 0 ? insertionOrder.get(left)! - insertionOrder.get(right)! : byPriority;
  };

  const remaining = new Map([...dependencies.entries()].map(([name, deps]) => [name, new Set(deps)]));
  const result: TypeScriptIntegration[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()].filter(([, deps]) => deps.size === 0).map(([name]) => name);
    if (ready.length === 0) {
      throw new Error("Cycle detected between integrations: " + [...remaining.keys()].join(", "));
    }
    ready.sort(compare);
    const next = ready[0];
    remaining.delete(next);
    for (const deps of remaining.values()) {
      deps.delete(next);
    }
    const integration = lookup.get(next);
    if (integration !== undefined) {
      result.push(integration);
    }
  }
  return result;
}
