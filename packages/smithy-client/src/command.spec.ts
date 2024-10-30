import { describe, expect, test as it } from "vitest";

import { Command } from "./command";

describe(Command.name, () => {
  it("has optional argument if the input type has no required members", async () => {
    type OptionalInput = {
      key?: string;
      optional?: string;
    };

    type RequiredInput = {
      key: string | undefined;
      optional?: string;
    };

    class WithRequiredInputCommand extends Command.classBuilder<RequiredInput, any, any, any, any>().build() {}

    class WithOptionalInputCommand extends Command.classBuilder<OptionalInput, any, any, any, any>().build() {}

    new WithRequiredInputCommand({ key: "1" });

    new WithOptionalInputCommand(); // expect no type error.
  });
  it("implements a classBuilder", async () => {
    class MyCommand extends Command.classBuilder<any, any, any, any, any>()
      .ep({
        Endpoint: { type: "builtInParams", name: "Endpoint" },
      })
      .m(function () {
        return [];
      })
      .s("SmithyMyClient", "SmithyMyOperation", {})
      .n("MyClient", "MyCommand")
      .f()
      .ser(async (_) => _)
      .de(async (_) => _)
      .build() {}

    const myCommand = new MyCommand({
      Prop: "prop1",
    });

    expect(myCommand).toBeInstanceOf(Command);
    expect(myCommand).toBeInstanceOf(MyCommand);
    expect(MyCommand.getEndpointParameterInstructions()).toEqual({
      Endpoint: { type: "builtInParams", name: "Endpoint" },
    });
    expect(myCommand.input).toEqual({
      Prop: "prop1",
    });

    // private method exists for compatibility
    expect((myCommand as any).serialize).toBeDefined();

    // private method exists for compatibility
    expect((myCommand as any).deserialize).toBeDefined();
  });
});
