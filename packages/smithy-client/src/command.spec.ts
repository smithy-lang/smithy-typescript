import { Command } from "./command";

describe(Command.name, () => {
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
