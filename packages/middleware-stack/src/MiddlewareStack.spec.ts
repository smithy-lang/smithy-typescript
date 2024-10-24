import {
  DeserializeHandlerArguments,
  DeserializeMiddleware,
  FinalizeHandler,
  FinalizeHandlerArguments,
  InitializeHandler,
  Pluggable,
} from "@smithy/types";
import { describe, expect, test as it, vi } from "vitest";

import { constructStack } from "./MiddlewareStack";

type input = Array<string>;
type output = object;

//return tagged union to make compiler happy
const getConcatMiddleware =
  (message: string) =>
  (next: FinalizeHandler<input, output>): InitializeHandler<input, output> =>
  (args: any) =>
    next({
      ...args,
      input: args.input.concat(message),
      request: undefined as any,
    });

describe("MiddlewareStack", () => {
  describe("add", () => {
    it("should sort middleware based on step, priority, and ording of adding", async () => {
      const stack = constructStack<input, output>();
      const bMW = getConcatMiddleware("B");
      stack.add(bMW, { name: "B" });
      stack.add(getConcatMiddleware("A"), {
        priority: "high",
      });
      stack.add(getConcatMiddleware("D"), {
        step: "build",
        name: "D",
      });
      stack.add(getConcatMiddleware("C"), {
        step: "build",
        priority: "high",
      });
      stack.add(getConcatMiddleware("E"), {
        step: "finalizeRequest",
      });
      stack.add(getConcatMiddleware("F"), { step: "finalizeRequest" });
      stack.add(getConcatMiddleware("G") as DeserializeMiddleware<input, output>, {
        priority: "low",
        step: "deserialize",
      });
      stack.add(getConcatMiddleware("H") as DeserializeMiddleware<input, output>, {
        aliases: ["h"],
        priority: "low",
        step: "deserialize",
      });
      const inner = vi.fn();

      const composed = stack.resolve(inner, {} as any);
      await composed({ input: [] });

      expect(inner.mock.calls.length).toBe(1);
      expect(inner).toBeCalledWith({
        input: ["A", "B", "C", "D", "E", "F", "G", "H"],
      });
    });

    it("should throw if duplicated name is found", () => {
      const stack = constructStack<input, output>();
      const aMW = getConcatMiddleware("A");
      stack.add(aMW, { name: "A" });
      expect(() => stack.add(aMW, { name: "A" })).toThrow("Duplicate middleware name 'A'");
    });

    it("should throw if duplicated name via aliases of existing entry is found", () => {
      const stack = constructStack<input, output>();
      const aMW = getConcatMiddleware("A");
      stack.add(aMW, { aliases: ["ALIAS"] });
      expect(() => stack.add(aMW, { name: "ALIAS" })).toThrow("Duplicate middleware name 'ALIAS'");
    });

    it("should throw if duplicated name via aliases of added entry is found", () => {
      const stack = constructStack<input, output>();
      const aMW = getConcatMiddleware("ALIAS");
      stack.add(aMW, { name: "ALIAS" });
      expect(() => stack.add(aMW, { aliases: ["ALIAS"] })).toThrow(
        "Duplicate middleware name 'anonymous (a.k.a. ALIAS)'"
      );
    });

    describe("config: override", () => {
      it("should override the middleware with same name if override config is set", async () => {
        const stack = constructStack<input, output>();
        stack.add(getConcatMiddleware("A"), { name: "A" });
        stack.add(getConcatMiddleware("override"), { name: "A", override: true });
        const inner = vi.fn();
        const composed = stack.resolve(inner, {} as any);
        await composed({ input: [] });
        expect(inner.mock.calls.length).toBe(1);
        expect(inner).toBeCalledWith({
          input: ["override"],
        });
      });

      it("should override the middleware with matching alias of existing entry if override config is set", async () => {
        const stack = constructStack<input, output>();
        stack.add(getConcatMiddleware("A"), { aliases: ["ALIAS"] });
        stack.add(getConcatMiddleware("override"), { name: "ALIAS", override: true });
        const inner = vi.fn();
        const composed = stack.resolve(inner, {} as any);
        await composed({ input: [] });
        expect(inner.mock.calls.length).toBe(1);
        expect(inner).toBeCalledWith({
          input: ["override"],
        });
      });

      it("should override the middleware with matching alias of added entry if override config is set", async () => {
        const stack = constructStack<input, output>();
        stack.add(getConcatMiddleware("A"), { name: "ALIAS" });
        stack.add(getConcatMiddleware("override"), { aliases: ["ALIAS"], override: true });
        const inner = vi.fn();
        const composed = stack.resolve(inner, {} as any);
        await composed({ input: [] });
        expect(inner.mock.calls.length).toBe(1);
        expect(inner).toBeCalledWith({
          input: ["override"],
        });
      });

      it("should throw if overriding middleware with same name different position", () => {
        const stack = constructStack<input, output>();
        stack.add(getConcatMiddleware("A"), { name: "A" });
        expect(() =>
          stack.add(getConcatMiddleware("override"), { name: "A", step: "serialize", override: true })
        ).toThrow(
          '"A" middleware with normal priority in initialize step cannot be overridden by "A" middleware with normal priority in serialize step.'
        );
      });

      it("should throw if overriding middleware with matching alias of existing entry different position", () => {
        const stack = constructStack<input, output>();
        stack.add(getConcatMiddleware("A"), { aliases: ["ALIAS"] });
        expect(() =>
          stack.add(getConcatMiddleware("override"), { name: "ALIAS", step: "serialize", override: true })
        ).toThrow(
          '"anonymous (a.k.a. ALIAS)" middleware with normal priority in initialize step cannot be overridden by "ALIAS" middleware with normal priority in serialize step.'
        );
      });

      it("should throw if overriding middleware with matching alias of added entry different position", () => {
        const stack = constructStack<input, output>();
        stack.add(getConcatMiddleware("A"), { name: "ALIAS" });
        expect(() =>
          stack.add(getConcatMiddleware("override"), { aliases: ["ALIAS"], step: "serialize", override: true })
        ).toThrow(
          '"ALIAS" middleware with normal priority in initialize step cannot be overridden by "anonymous (a.k.a. ALIAS)" middleware with normal priority in serialize step.'
        );
      });
    });
  });

  describe("addRelativeTo", () => {
    it("should allow adding middleware relatively based relation and order of adding", async () => {
      const stack = constructStack<input, output>();
      stack.addRelativeTo(getConcatMiddleware("H"), {
        aliases: ["AliasH"],
        relation: "after",
        toMiddleware: "G",
      });
      stack.add(getConcatMiddleware("A"), {
        name: "A",
      });
      stack.addRelativeTo(getConcatMiddleware("C"), {
        name: "C",
        relation: "after",
        toMiddleware: "A",
      });
      stack.addRelativeTo(getConcatMiddleware("B"), {
        name: "B",
        relation: "after",
        toMiddleware: "A",
      });
      stack.addRelativeTo(getConcatMiddleware("D"), {
        name: "D",
        relation: "after",
        toMiddleware: "C",
      });
      stack.add(getConcatMiddleware("G"), {
        name: "G",
        priority: "low",
      });
      stack.addRelativeTo(getConcatMiddleware("E"), {
        name: "E",
        relation: "before",
        toMiddleware: "F",
      });
      stack.addRelativeTo(getConcatMiddleware("F"), {
        name: "F",
        relation: "before",
        toMiddleware: "G",
      });
      stack.addRelativeTo(getConcatMiddleware("I"), {
        aliases: ["AliasI"],
        relation: "after",
        toMiddleware: "AliasH",
      });
      stack.addRelativeTo(getConcatMiddleware("J"), {
        name: "J",
        relation: "after",
        toMiddleware: "AliasI",
      });
      const inner = vi.fn();
      const composed = stack.resolve(inner, {} as any);
      await composed({ input: [] });
      expect(inner.mock.calls.length).toBe(1);
      expect(inner).toBeCalledWith({ input: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] });
    });

    it("should add relative middleware within the scope of adjacent absolute middleware", async () => {
      const stack = constructStack<input, output>();
      stack.addRelativeTo(getConcatMiddleware("B"), {
        name: "B",
        relation: "after",
        toMiddleware: "A",
      });
      stack.add(getConcatMiddleware("A"), { name: "A" });
      stack.addRelativeTo(getConcatMiddleware("C"), {
        name: "C",
        relation: "before",
        toMiddleware: "AliasD",
      });
      stack.add(getConcatMiddleware("D"), { aliases: ["AliasD"] });
      stack.addRelativeTo(getConcatMiddleware("F"), {
        aliases: ["AliasF"],
        relation: "after",
        toMiddleware: "AliasD",
      });
      stack.addRelativeTo(getConcatMiddleware("E"), {
        relation: "before",
        toMiddleware: "AliasF",
      });
      stack.add(getConcatMiddleware("G"), { name: "G" });
      const inner = vi.fn();
      const composed = stack.resolve(inner, {} as any);
      await composed({ input: [] });
      expect(inner.mock.calls.length).toBe(1);
      expect(inner).toBeCalledWith({ input: ["A", "B", "C", "D", "E", "F", "G"] });
    });

    it("should not add self-referenced relative middleware", async () => {
      const stack = constructStack<input, output>();
      stack.addRelativeTo(getConcatMiddleware("A"), {
        name: "A",
        relation: "before",
        toMiddleware: "B",
      });
      stack.addRelativeTo(getConcatMiddleware("B"), {
        name: "B",
        relation: "before",
        toMiddleware: "C",
      });
      stack.addRelativeTo(getConcatMiddleware("C"), {
        name: "C",
        relation: "before",
        toMiddleware: "AliasD",
      });
      stack.addRelativeTo(getConcatMiddleware("D"), {
        aliases: ["AliasD"],
        relation: "after",
        toMiddleware: "A",
      });
      const inner = vi.fn();
      const composed = stack.resolve(inner, {} as any);
      await composed({ input: [] });
      expect(inner.mock.calls.length).toBe(1);
      expect(inner).toBeCalledWith({ input: [] });
    });

    it("should throw if add middleware relative to non-exist middleware", async () => {
      expect.assertions(1);
      const stack = constructStack<input, output>();
      stack.addRelativeTo(getConcatMiddleware("foo"), {
        name: "foo",
        relation: "before",
        toMiddleware: "non_exist",
      });
      const inner = vi.fn();
      try {
        stack.resolve(inner, {} as any);
      } catch (e) {
        expect(e.message).toBe("non_exist is not found when adding foo middleware before non_exist");
      }
    });

    describe("config: override", () => {
      it("should override the middleware with same name if override config is set", async () => {
        const stack = constructStack<input, output>();
        stack.add(getConcatMiddleware("A"), { name: "A" });
        stack.addRelativeTo(getConcatMiddleware("B"), { name: "B", relation: "after", toMiddleware: "A" });
        stack.addRelativeTo(getConcatMiddleware("override"), {
          name: "B",
          relation: "after",
          toMiddleware: "A",
          override: true,
        });
        const inner = vi.fn();
        const composed = stack.resolve(inner, {} as any);
        await composed({ input: [] });
        expect(inner.mock.calls.length).toBe(1);
        expect(inner).toBeCalledWith({
          input: ["A", "override"],
        });
      });

      it("should override the middleware with matching alias of existing entry if override config is set", async () => {
        const stack = constructStack<input, output>();
        stack.add(getConcatMiddleware("A"), { name: "A" });
        stack.addRelativeTo(getConcatMiddleware("B"), {
          aliases: ["ALIAS"],
          relation: "after",
          toMiddleware: "A",
        });
        stack.addRelativeTo(getConcatMiddleware("override"), {
          name: "ALIAS",
          relation: "after",
          toMiddleware: "A",
          override: true,
        });
        const inner = vi.fn();
        const composed = stack.resolve(inner, {} as any);
        await composed({ input: [] });
        expect(inner.mock.calls.length).toBe(1);
        expect(inner).toBeCalledWith({
          input: ["A", "override"],
        });
      });

      it("should override the middleware with matching alias of added entry if override config is set", async () => {
        const stack = constructStack<input, output>();
        stack.add(getConcatMiddleware("A"), { name: "A" });
        stack.addRelativeTo(getConcatMiddleware("ALIAS"), {
          name: "ALIAS",
          relation: "after",
          toMiddleware: "A",
        });
        stack.addRelativeTo(getConcatMiddleware("override"), {
          aliases: ["ALIAS"],
          relation: "after",
          toMiddleware: "A",
          override: true,
        });
        const inner = vi.fn();
        const composed = stack.resolve(inner, {} as any);
        await composed({ input: [] });
        expect(inner.mock.calls.length).toBe(1);
        expect(inner).toBeCalledWith({
          input: ["A", "override"],
        });
      });

      it("should throw if overriding middleware with same name different position", () => {
        const stack = constructStack<input, output>();
        stack.add(getConcatMiddleware("A"), { name: "A" });
        stack.addRelativeTo(getConcatMiddleware("B"), { name: "B", relation: "after", toMiddleware: "A" });
        expect(() =>
          stack.addRelativeTo(getConcatMiddleware("override"), {
            name: "B",
            relation: "before",
            toMiddleware: "A",
            override: true,
          })
        ).toThrow('"B" middleware after "A" middleware cannot be overridden by "B" middleware before "A" middleware.');
      });

      it("should throw if overriding middleware with matching alias of existing entry different position", () => {
        const stack = constructStack<input, output>();
        stack.add(getConcatMiddleware("A"), { name: "A" });
        stack.addRelativeTo(getConcatMiddleware("B"), {
          aliases: ["ALIAS"],
          relation: "after",
          toMiddleware: "A",
        });
        expect(() =>
          stack.addRelativeTo(getConcatMiddleware("override"), {
            name: "ALIAS",
            relation: "before",
            toMiddleware: "A",
            override: true,
          })
        ).toThrow(
          '"anonymous (a.k.a. ALIAS)" middleware after "A" middleware cannot be overridden by "ALIAS" middleware before "A" middleware.'
        );
      });

      it("should throw if overriding middleware with matching alias of added entry different position", () => {
        const stack = constructStack<input, output>();
        stack.add(getConcatMiddleware("A"), { name: "A" });
        stack.addRelativeTo(getConcatMiddleware("ALIAS"), {
          name: "ALIAS",
          relation: "after",
          toMiddleware: "A",
        });
        expect(() =>
          stack.addRelativeTo(getConcatMiddleware("override"), {
            aliases: ["ALIAS"],
            relation: "before",
            toMiddleware: "A",
            override: true,
          })
        ).toThrow(
          '"ALIAS" middleware after "A" middleware cannot be overridden by "anonymous (a.k.a. ALIAS)" middleware before "A" middleware.'
        );
      });
    });
  });

  describe("clone", () => {
    it("should allow cloning", async () => {
      const stack = constructStack<input, output>();
      const bMiddleware = getConcatMiddleware("B");
      stack.add(bMiddleware);
      stack.add(getConcatMiddleware("A"), {
        name: "A",
        priority: "high",
      });
      stack.add(getConcatMiddleware("C"), {
        aliases: ["AliasC"],
      });
      const secondStack = stack.clone();
      const inner = vi.fn();
      await secondStack.resolve(inner, {} as any)({ input: [] });
      expect(inner.mock.calls.length).toBe(1);
      expect(inner).toBeCalledWith({ input: ["A", "B", "C"] });
      // validate adding middleware to cloned stack won't affect the original stack.
      inner.mockClear();
      secondStack.add(getConcatMiddleware("D"));
      secondStack.add(getConcatMiddleware("E"), {
        aliases: ["AliasE"],
      });
      await secondStack.resolve(inner, {} as any)({ input: [] });
      expect(inner).toBeCalledWith({ input: ["A", "B", "C", "D", "E"] });
      inner.mockClear();
      await stack.resolve(inner, {} as any)({ input: [] });
      expect(inner).toBeCalledWith({ input: ["A", "B", "C"] });
    });
  });

  describe("concat", () => {
    it("should allow combining stacks", async () => {
      const stack = constructStack<input, output>();
      stack.add(getConcatMiddleware("A"));
      stack.add(getConcatMiddleware("B"), {
        aliases: ["AliasB"],
        priority: "low",
      });

      const secondStack = constructStack<input, output>();
      secondStack.add(getConcatMiddleware("D"), {
        step: "build",
        priority: "low",
      });
      secondStack.addRelativeTo(getConcatMiddleware("C"), {
        relation: "after",
        toMiddleware: "AliasB",
      });

      const inner = vi.fn();
      await stack.concat(secondStack).resolve(inner, {} as any)({ input: [] });
      expect(inner.mock.calls.length).toBe(1);
      expect(inner).toBeCalledWith({ input: ["A", "B", "C", "D"] });
    });

    it("should not touch the stack of the concat() caller or the parameter", async () => {
      const stack = constructStack<input, output>();
      stack.add(getConcatMiddleware("A"));
      const secondStack = constructStack<input, output>();
      secondStack.add(getConcatMiddleware("B"));
      const inner = vi.fn();
      await stack.concat(secondStack).resolve(inner, {} as any)({ input: [] });
      expect(inner.mock.calls.length).toBe(1);
      expect(inner).toBeCalledWith({ input: ["A", "B"] });
      inner.mockClear();
      await secondStack.resolve(inner, {} as any)({ input: [] });
      expect(inner).toBeCalledWith({ input: ["B"] });
      inner.mockClear();
      await stack.resolve(inner, {} as any)({ input: [] });
      expect(inner).toBeCalledWith({ input: ["A"] });
    });
  });

  describe("remove", () => {
    it("should remove middleware by name", async () => {
      const stack = constructStack<input, output>();
      stack.add(getConcatMiddleware("don't remove me"), { name: "notRemove" });
      stack.addRelativeTo(getConcatMiddleware("remove me!"), {
        relation: "after",
        toMiddleware: "notRemove",
        name: "toRemove",
      });

      await stack.resolve(({ input }: FinalizeHandlerArguments<Array<string>>) => {
        expect(input.sort()).toEqual(["don't remove me", "remove me!"]);
        return Promise.resolve({ response: {} });
      }, {} as any)({ input: [] });

      stack.remove("toRemove");

      const inner = vi.fn();
      await stack.resolve(inner, {} as any)({ input: [] });
      expect(inner.mock.calls.length).toBe(1);
      expect(inner).toBeCalledWith({ input: ["don't remove me"] });
    });

    it("should remove middleware by alias of existing entry", async () => {
      const stack = constructStack<input, output>();
      stack.add(getConcatMiddleware("don't remove me"), { name: "notRemove" });
      stack.addRelativeTo(getConcatMiddleware("remove me!"), {
        relation: "after",
        toMiddleware: "notRemove",
        aliases: ["toRemove"],
      });

      await stack.resolve(({ input }: FinalizeHandlerArguments<Array<string>>) => {
        expect(input.sort()).toEqual(["don't remove me", "remove me!"]);
        return Promise.resolve({ response: {} });
      }, {} as any)({ input: [] });

      stack.remove("toRemove");

      const inner = vi.fn();
      await stack.resolve(inner, {} as any)({ input: [] });
      expect(inner.mock.calls.length).toBe(1);
      expect(inner).toBeCalledWith({ input: ["don't remove me"] });
    });

    it("should remove middleware by reference", async () => {
      const stack = constructStack<input, output>();
      const mw = getConcatMiddleware("remove all references of me");
      stack.add(mw, { name: "toRemove1" });
      stack.add(getConcatMiddleware("don't remove me!"));
      stack.add(mw, { aliases: ["toRemove2"] });
      stack.remove(mw);

      const inner = vi.fn();
      await stack.resolve(inner, {} as any)({ input: [] });
      expect(inner.mock.calls.length).toBe(1);
      expect(inner).toBeCalledWith({ input: ["don't remove me!"] });
    });
  });

  describe("removeByTag", () => {
    it("should allow the removal of middleware by tag", async () => {
      const stack = constructStack<input, output>();
      stack.add(getConcatMiddleware("not removed"), {
        name: "not removed",
        tags: ["foo", "bar"],
      });
      stack.addRelativeTo(getConcatMiddleware("remove me!"), {
        aliases: ["remove me!"],
        relation: "after",
        toMiddleware: "not removed",
        tags: ["foo", "bar", "baz"],
      });

      await stack.resolve(({ input }: FinalizeHandlerArguments<Array<string>>) => {
        expect(input.sort()).toEqual(["not removed", "remove me!"]);
        return Promise.resolve({ response: {} });
      }, {} as any)({ input: [] });

      stack.removeByTag("baz");

      await stack.resolve(({ input }: DeserializeHandlerArguments<Array<string>>) => {
        expect(input).toEqual(["not removed"]);
        return Promise.resolve({ response: {} });
      }, {} as any)({ input: [] });
    });
  });

  it("checks identifyOnResolve calls to external instances due to version mismatching", () => {
    const newStack = constructStack<input, output>();
    const oldStack = constructStack<input, output>();

    delete (oldStack as any).identifyOnResolve;
    oldStack.clone = () => oldStack;
    oldStack.concat = <S>() => oldStack as S;
    oldStack.applyToStack = () => void 0;

    expect(oldStack.identifyOnResolve).toBeUndefined();
    expect(() => {
      newStack.concat(oldStack);
      newStack.clone();
    }).not.toThrow();
  });

  describe("use", () => {
    it("should apply customizations from pluggables", async () => {
      const stack = constructStack<input, output>();
      const plugin: Pluggable<input, output> = {
        applyToStack: (stack) => {
          stack.addRelativeTo(getConcatMiddleware("second"), {
            relation: "after",
            toMiddleware: "first",
          });
          stack.add(getConcatMiddleware("first"), { name: "first" });
        },
      };
      stack.use(plugin);
      const inner = vi.fn(({ input }: DeserializeHandlerArguments<input>) => {
        expect(input).toEqual(["first", "second"]);
        return Promise.resolve({ response: {} });
      });
      await stack.resolve(inner, {} as any)({ input: [] });
      expect(inner.mock.calls.length).toBe(1);
    });
  });
});
