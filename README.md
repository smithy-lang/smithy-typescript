# <img alt="Smithy" src="https://github.com/smithy-lang/smithy/blob/main/docs/_static/smithy-anvil.svg?raw=true" width="32"> Smithy TypeScript

> **WARNING: Smithy TypeScript is currently in [Developer Preview](https://aws.amazon.com/blogs/devops/smithy-server-and-client-generator-for-typescript). All interfaces and supported JavaScript platforms are subject to change.**

`smithy-typescript` includes the reference implementations of the [Smithy](https://smithy.io/) code generators for [TypeScript](https://www.typescriptlang.org/).

For Client SDK code generation, the `typescript-client-codegen` plugin provides a framework for generating extensible TypeScript clients that can support multiple JavaScript platforms, including Node.js, Browser, and React-Native. See [the section on generating a client to see how to get started](#generating-a-client), or [the `typescript-client-codegen` documentation](#client-sdk-code-generation-typescript-client-codegen-plugin).

> Note: Node.js support includes versions >= 18, and is subject to change.

For Server SDK code generation, the `typescript-server-codegen` plugin provides a framework for generating server scaffolding at a higher level of abstraction and with type safety. More documentation can be found at in [the `typescript-server-codegen` documentation](#server-sdk-code-generation-typescript-server-codegen-plugin), or [smithy.io](https://smithy.io/2.0/languages/typescript/ts-ssdk/index.html).

## Generating a client

The Smithy TypeScript `typescript-client-codegen` code generator in this repository generates TypeScript clients from Smithy models, and can be built with both the idiomatic [Smithy CLI](#using-smithy-typescript-with-the-smithy-cli) or through [Gradle](#using-smithy-typescript-with-gradle).

> The Smithy CLI is a prerequisite for this section when using the `smithy init` commands. See [the installation guide](https://smithy.io/2.0/guides/smithy-cli/cli_installation.html) for how to install the Smithy CLI. If installing the Smithy CLI is not preferred, the templates used can be found in the [Smithy Examples repository](https://github.com/smithy-lang/smithy-examples).

For additional configuration, see [the `typescript-client-codegen` documentation](#client-sdk-code-generation-typescript-client-codegen-plugin) and [the documentation for `smithy-build.json`](https://smithy.io/2.0/guides/building-models/build-config.html).

### Using Smithy TypeScript with the Smithy CLI

Using the Smithy CLI, a new Smithy CLI project can be created using the default `smithy init` template. In this example, the project will be called `smithy-typescript-example-client`.

```shell
smithy init -o smithy-typescript-example-client
cd smithy-typescript-example-client/
```

This will create a project with the following directory structure:

```text
smithy-typescript-example-client/
├── README.md
├── models
│   └── weather.smithy
└── smithy-build.json
```

To add a minimal `typescript-client-codegen` plugin, add the following to `smithy-build.json`:

```json
// smithy-build.json
{
  "version": "1.0",
  "sources": ["models"],
  // Add the Smithy TypeScript code generator dependency
  "maven": {
    "dependencies": ["software.amazon.smithy.typescript:smithy-typescript-codegen:0.36.1"]
  },
  "plugins": {
    // Add the Smithy TypeScript client plugin
    "typescript-client-codegen": {
      // Minimal configuration: add package name and version
      "package": "@smithy/typescript-example-client",
      "packageVersion": "0.0.1"
    }
  }
}
```

After `smithy-build.json` has been configured, run `smithy build`. This will code generate the TypeScript client under the `source` projection, found in the `build/smithy/source/typescript-client-codegen` directory.

Verify the client is able to compile by running the following:

```shell
cd build/smithy/source/typescript-client-codegen
# Yarn is used in this example, but equivalent commands using other package managers can be used, e.g. npm and pnpm
yarn
yarn build
```

> Note that running the NPM scripts to verify the generated TypeScript client is NOT part of the code generation process, and needs to be explicitly executed after the client is generated.

### Using Smithy TypeScript with Gradle

Using the Smithy CLI, a new Gradle project can be created using the `quickstart-gradle` template. In this example, the project will be called `smithy-typescript-example-client-gradle`.

```shell
smithy init -t quickstart-gradle -o smithy-typescript-example-client-gradle
cd smithy-typescript-example-client-gradle/
```

This will create a project with the following directory structure:

```text
smithy-typescript-example-client-gradle/
├── README.md
├── build.gradle.kts
├── gradle
│   └── wrapper
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── gradle.properties
├── gradlew
├── gradlew.bat
├── models
│   └── weather.smithy
├── settings.gradle.kts
└── smithy-build.json
```

To add a minimal `typescript-client-codegen` plugin, add the following to `smithy-build.json`:

```json
// smithy-build.json
{
  "version": "1.0",
  "sources": ["models"],
  "plugins": {
    // Add the Smithy TypeScript client plugin
    "typescript-client-codegen": {
      // Minimal configuration: add package name and version
      "package": "@smithy/typescript-example-client",
      "packageVersion": "0.0.1"
    }
  }
}
```

> Note: Maven dependencies cannot be configured in `smithy-build.json` for Gradle projects.

Then, add the `smithy-typescript-codegen` dependency in `build.gradle.kts`:

```kotlin
plugins {
    id("java-library")
    id("software.amazon.smithy.gradle.smithy-jar").version("0.10.1")
}

repositories {
    mavenLocal()
    mavenCentral()
}

dependencies {
    val smithyVersion: String by project

    smithyCli("software.amazon.smithy:smithy-cli:$smithyVersion")

    // Add the Smithy TypeScript code generator dependency
    implementation("software.amazon.smithy.typescript:smithy-typescript-codegen:0.36.1")

    // Uncomment below to add various smithy dependencies (see full list of smithy dependencies in https://github.com/awslabs/smithy)
    // implementation("software.amazon.smithy:smithy-model:$smithyVersion")
    // implementation("software.amazon.smithy:smithy-linters:$smithyVersion")
}
```

After `smithy-build.json` and `build.gradle.kts` have been configured, run `./gradlew clean build`. This will code generate the TypeScript client under the `source` projection, found in the `build/smithyprojections/quickstart-gradle/source/typescript-client-codegen` directory.

Verify the client is able to compile by running the following:

```shell
cd build/smithyprojections/quickstart-gradle/source/typescript-client-codegen
# Yarn is used in this example, but equivalent commands using other package managers can be used, e.g. npm and pnpm
yarn
yarn build
```

> Note that running the NPM scripts to verify the generated TypeScript client is NOT part of the code generation process, and needs to be explicitly executed after the client is generated.

For another example of a Gradle project using Smithy Typescript, the `smithy-typescript-codegen-test` package can be referenced as it builds different TypeScript artifacts through projections.

See [the Smithy documentation](https://smithy.io/2.0/guides/building-models/gradle-plugin.html) for more information on build Smithy projects with Gradle.

> Note: the Smithy Gradle Plugin is under heavy development and is subject to breaking changes.

## TypeScript code generation

By default, the Smithy TypeScript code generators provide the code generation framework to generate TypeScript artifacts (e.g. types, interfaces, implementations) of specified Smithy models. However there are implementations for code generation and TypeScript that either need to be implemented or consumed from third-party packages:

- Protocols: Protocols define how operation shapes (for clients and servers, these are usually inputs and outputs) are serialized and deserialized on the wire. This behavior can be defined in Smithy through [protocol traits](https://smithy.io/2.0/spec/protocol-traits.html) with corresponding implementations of [the `ProtocolGenerator` interface](smithy-typescript-codegen/src/main/java/software/amazon/smithy/typescript/codegen/integration/ProtocolGenerator.java). For example, [AWS SDK for JavaScript v3](https://github.com/aws/aws-sdk-js-v3), a customer of Smithy TypeScript, implements the [AWS protocols](https://smithy.io/2.0/aws/protocols/index.html) in the `software.amazon.smithy.typescript:smithy-aws-typescript-codegen` package. See [the section on protocol generator implementations for more details](#protocol-generator-implementations).
- Publishing: There is no idiomatic utility to publish generated artifacts since package distribution can vary depending on different technical requirements. For example, [AWS SDK for JavaScript v3](https://github.com/aws/aws-sdk-js-v3), a customer of Smithy TypeScript, has custom tooling to manage versioning, change logs, and publishing in a monorepo. See [the section on publishing client packages for more details](#publishing-a-client-sdk-package).
- Endpoint resolution (clients): Endpoint resolution is not implemented by default due to a variety of different implementations. In most cases, providing a default provider in the runtime config for the client config `endpoint` property should suffice. More complex use cases include [the `@smithy.rules#endpointRuleSet` trait](https://smithy.io/2.0/additional-specs/rules-engine/specification.html#smithy-rules-endpointruleset-trait) which provides [a complete DSL for endpoint resolution](https://smithy.io/2.0/additional-specs/rules-engine/index.html). See [the section on handling endpoint resolution for more details](#handling-endpoint-resolution).
- Operation handler implementations (servers): The server code generator provides the scaffolding for operations. The operation handlers defining the business logic of the Smithy service need to be implemented manually.

### Client SDK code generation: `typescript-client-codegen` plugin

#### `typescript-client-codegen` plugin configuration

> Note: Although plugin configuration is maintained with backward compatibility in mind, breaking changes may still occur.

[`TypeScriptSettings`](smithy-typescript-codegen/src/main/java/software/amazon/smithy/typescript/codegen/TypeScriptSettings.java) contains all of the settings enabled from `smithy-build.json` and helper methods and types. The up-to-date list of top-level properties enabled for `typescript-client-codegen` can be found in `TypeScriptSettings.ArtifactType.CLIENT`.

| Setting                   | Required | Description                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package`                 | Yes      | Name of the package in `package.json`.                                                                                                                                                                                                                                                                                                                           |
| `packageVersion`          | Yes      | Version of the package in `package.json`.                                                                                                                                                                                                                                                                                                                        |
| `packageDescription`      | No       | Description of the package in `package.json`. The default value is `${package} client`                                                                                                                                                                                                                                                                           |
| `packageJson`             | No       | Custom `package.json` properties that will be merged with the base `package.json`. The default value is an empty object.                                                                                                                                                                                                                                         |
| `packageManager`          | No       | Configured package manager for the package. The default value is `yarn`.                                                                                                                                                                                                                                                                                         |
| `service`                 | No       | The Shape ID of the service to generate a client for. If not provided, the code generator will attempt to infer the service Shape ID. If there is exactly 1 service found in the model, then the service is used as the inferred Shape ID. If no services are found, then code generation fails. If more than 1 service is found, then code generation fails.    |
| `protocol`                | No       | The Shape ID of the protocol used to generate serialization and deserialization. If not provided, the code generator will attempt to resolve the highest priority service protocol supported in code generation (registered through `TypeScriptIntegration`). If no protocols are found, code generation will use serialization and deserialization error stubs. |
| `private`                 | No       | Whether the package is `private` in `package.json`. The default value is `false`.                                                                                                                                                                                                                                                                                |
| `requiredMemberMode`      | No       | **NOT RECOMMENDED DUE TO BACKWARD COMPATIBILITY CONCERNS.** Sets whether members marked with the `@required` trait are allowed to be `undefined`. See more details on the risks in `TypeScriptSettings.RequiredMemberMode`. The default value is `nullable`.                                                                                                     |
| `bigNumberMode`           | No       | use `"native"` to serialize and deserialize Smithy BigInteger and BigDecimal to `bigint` and `@smithy/core/serde`'s `NumericValue`. Otherwise, use `"big.js"` to serialize and deserialize with that numeric library.                                                                                                                                            |
| `createDefaultReadme`     | No       | Whether to generate a default `README.md` for the package. The default value is `false`.                                                                                                                                                                                                                                                                         |
| `useLegacyAuth`           | No       | **NOT RECOMMENDED, AVAILABLE ONLY FOR BACKWARD COMPATIBILITY CONCERNS.** Flag that enables using legacy auth. When in doubt, use the default identity and auth behavior (not configuring `useLegacyAuth`) as the golden path.                                                                                                                                    |
| `serviceProtocolPriority` | No       | Map of service `ShapeId` strings to lists of protocol `ShapeId` strings. Used to override protocol selection behavior.                                                                                                                                                                                                                                           |
| `defaultProtocolPriority` | No       | List of protocol `ShapeId` strings. Lower precedence than `serviceProtocolPriority` but applies to all services.                                                                                                                                                                                                                                                 |

#### `typescript-client-codegen` plugin artifacts

Smithy TypeScript clients are extensible (see [the AWS blog post on the middleware stack](https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/)), robust, and support multiple JavaScript platforms. The main components of a client are the following (`$SERVICE` is the name of a Smithy service, `$OPERATION` is the name of a Smithy operation, `$N` is a number starting from 0):

- Client classes: A standalone tree-shakeable client defined in `src/$SERVICEClient.ts` and an aggregated client defined in `src/$SERVICE.ts`. The client classes are the entry point to calling a service, defining the input configuration of the service and adding any service-level middleware.

  ```typescript
  import { $SERVICEClient, $SERVICE } from "..."; // example client package

  const individualClient = new $SERVICEClient({
    // Input configuration with type hints
  });

  const aggregatedClient = new $SERVICE({
    // Input configuration with type hints
  });
  ```

- Command classes: Individual commands defined in `src/commands/$OPERATIONCommand.ts`. These classes include operation-level middleware and additional values to the client resolved configuration through the middleware context.

  ```typescript
  import { $SERVICEClient, $OPERATIONCommand, $OPERATIONCommandOutput } from "..."; // example client package

  const individualClient = new $SERVICEClient({
    // Input configuration with type hints
  });

  const response: Promise<$OPERATIONCommandOutput> = individualClient.send(
    new $OPERATIONCommand({
      // Operation input with type hints
      // Operations can also be called callback style or with HandlerOptions
    })
  );
  ```

- Models: Types and interfaces exported from `models/index.ts`, found individually in `models/model_$N.ts`, and errors including a base `$SERVICEServicexception.ts`.

  ```typescript
  import { $SERVICEClient, $SERVICEServiceException, $OPERATIONCommand, $OPERATIONCommandOutput } from "..."; // example client package

  const individualClient = new $SERVICEClient({
    // Input configuration with type hints
  });

  try {
    // $OPERATIONCommandOutput generated from the Smithy model
    const response: $OPERATIONCommandOutput = await individualClient.send(new $OPERATIONCommand({}));
  } catch (error) {
    // If more errors are defined in the Smithy model, then more extensive checks can be made
    if (error instanceof $SERVICEServiceException) {
      console.error("Oh no, a service exception was thrown!");
    }
    throw error;
  }
  ```

- Runtime Configurations: Populated default values for a client input configuration for different platforms, currently supporting Node.js, Browser, and React-Native. All of these have a shared runtime configuration that is overwritten with more specific platform values. Not every client input configuration needs a default value, but it is best practice to provide a reasonable default. For example, the `extensions` property defaults to an empty array when no runtime extensions are specified.

  ```text
  Least-specific

  ┌──────────────────────────────────────────────────────────┐
  │ Shared Runtime Configuration (`runtimeConfig.shared.ts`) │
  └──────────────────────────────────────────────────────────┘
                 │                                   │
  ┌──────────────────────────────┐ ┌─────────────────────────────────────-┐
  │ Node.js (`runtimeConfig.ts`) │ │ Browser (`runtimeConfig.browser.ts`) │
  └──────────────────────────────┘ └──────────────────────────────────────┘
                                                     │
                                   ┌─────────────────────────────────────────-┐
                                   │ React-Native (`runtimeConfig.native.ts`) │
                                   └──────────────────────────────────────────┘

  Most-specific (overrides values from parent)
  ```

- Runtime Extensions: Interfaces to implement extensions enabling alternative default values to the runtime configuration. See [the section on customizing TypeScript Client Configuration for more details](#typescript-client-configuration).
- Package Configuration files: `package.json` and TypeScript configuration files for different platforms.

Other directories could include code generated [paginators](https://smithy.io/2.0/spec/behavior-traits.html#pagination), [waiters](https://smithy.io/2.0/additional-specs/waiters.html), endpoint resolvers, etc., but are usually generated only when traits are present. If code-generating custom files for the SDK client, it is recommended to use a separate directory for separation of concerns.

Here is the directory structure of the generated artifacts from [the example client in the getting started section](#using-smithy-typescript-with-the-smithy-cli).

```
build/smithy/source/typescript-client-codegen/
├── package.json
├── src
│   ├── Weather.ts
│   ├── WeatherClient.ts
│   ├── commands
│   ├── extensionConfiguration.ts
│   ├── index.ts
│   ├── models
│   ├── pagination
│   ├── runtimeConfig.browser.ts
│   ├── runtimeConfig.native.ts
│   ├── runtimeConfig.shared.ts
│   ├── runtimeConfig.ts
│   └── runtimeExtensions.ts
├── tsconfig.cjs.json
├── tsconfig.es.json
├── tsconfig.json
├── tsconfig.types.json
└── typedoc.json
```

#### Code generation implementations not included

Smithy TypeScript provides default code generation implementations for generating TypeScript clients, but also requires customers to either implement or consume certain implementations where there is no default.

For Smithy TypeScript clients, the main implementations not provided are [protocol generators](#protocol-generator-implementations) and [handling endpoint resolution](#handling-endpoint-resolution) (see [the TypeScript code generation section](#typescript-code-generation)).

> If there are items missing from this section, feel free to [create an issue](https://github.com/smithy-lang/smithy-typescript/issues/new).

##### Protocol generator implementations

Protocols define how operation inputs and outputs are serialized and deserialized on the wire. This behavior can be defined in Smithy through [protocol traits](https://smithy.io/2.0/spec/protocol-traits.html) with corresponding implementations of [the `ProtocolGenerator` interface](smithy-typescript-codegen/src/main/java/software/amazon/smithy/typescript/codegen/integration/ProtocolGenerator.java) in Smithy TypeScript. Besides the `ProtocolGenerator` interface, Smithy TypeScript has additional abstract classes that partially implement the `ProtocolGenerator` interface and can be extended: [`HttpBindingProtocolGenerator` for HTTP binding protocols](smithy-typescript-codegen/src/main/java/software/amazon/smithy/typescript/codegen/integration/HttpBindingProtocolGenerator.java) and [`HttpRpcProtocolGenerator` for HTTP RPC protocols](smithy-typescript-codegen/src/main/java/software/amazon/smithy/typescript/codegen/integration/HttpRpcProtocolGenerator.java).

Once a `ProtocolGenerator` is implemented, the implementation can be registered through a `TypeScriptIntegration`:

- `TypeScriptIntegration` with `ProtocolGenerator` implementation:

  ```java
  // src/main/java/typescript/example/client/gradle/ExampleClientProtocolGeneratorIntegration.java
  package typescript.example.client.gradle;

  // ...

  public class ExampleClientProtocolGeneratorIntegration implements TypeScriptIntegration {
      // ProtocolGenerator implementation is inline for brevity, but should be in its
      // own file
      private static class ExampleClientProtocolGenerator implements ProtocolGenerator {
          // Protocol generator for a @example.client#protocol protocol trait
          @Override
          public ShapeId getProtocol() {
              return ShapeId.from("example.client#protocol");
          }
          // Implement ProtocolGenerator methods ...
      }

      @Override
      public List<ProtocolGenerator> getProtocolGenerators() {
          return List.of(new ExampleClientProtocolGenerator());
      }
  }
  ```

- Registering the `TypeScriptIntegration`:
  ```java
  // src/main/resources/META-INF/services/software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration
  typescript.example.client.gradle.ExampleClientProtocolGeneratorIntegration
  ```

See [the section on customizations via `TypeScriptIntegration` for more details](#customizations-via-typescriptintegration).

> Note: [AWS SDK for JavaScript v3](https://github.com/aws/aws-sdk-js-v3), a customer of Smithy TypeScript, implements the [AWS protocols](https://smithy.io/2.0/aws/protocols/index.html) and can be consumed by adding the `software.amazon.smithy.typescript:smithy-aws-typescript-codegen` package.

##### Handling endpoint resolution

Endpoint resolution is not implemented by default due to the inherent complexity. By default, if no endpoint resolution is provided, customers will not be able to pass in an endpoint to the client (TypeScript will fail to compile).

Smithy TypeScript has the `CustomEndpoints` configuration which can be used to add the `endpoint` property to the client configuration, and the `TypeScriptIntegration::getRuntimeConfigWriters()` method can be used to provide a default endpoint:

- `TypeScriptIntegration` implementation:

  ```java
  // src/main/java/typescript/example/client/gradle/ExampleClientEndpointResolutionIntegration.java
  package typescript.example.client.gradle;

  // ...

  public class ExampleClientEndpointResolutionIntegration implements TypeScriptIntegration {
      @Override
      public List<RuntimeClientPlugin> getClientPlugins() {
          return List.of(
              RuntimeClientPlugin.builder()
                  .withConventions(
                      TypeScriptDependency.CONFIG_RESOLVER.dependency,
                      "CustomEndpoints",
                      Convention.HAS_CONFIG)
                  .build());
      }

      @Override
      public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
          TypeScriptSettings settings,
          Model model,
          SymbolProvider symbolProvider,
          LanguageTarget target
      ) {
          // Runtime config value also be specified per platform by using the `target`
          // argument, e.g.
          // if (target.equals(LanguageTarget.NODE)) { ... }
          if (target.equals(LanguageTarget.SHARED)) {
              // This example provides an arbitrary endpoint on the shared runtime config
              return Map.of("endpoint", w -> w.write("$S", "https://www.example.com"));
          }
          // No need to redefine endpoint for other targets since it's inherited from the
          // shared target
          return Collections.emptyMap();
      }
  }
  ```

- Registering the `TypeScriptIntegration`:
  ```java
  // src/main/resources/META-INF/services/software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration
  typescript.example.client.gradle.ExampleClientEndpointResolutionIntegration
  ```

Customers can then pass in an endpoint to the client configuration:

```typescript
import { $SERVICEClient } from "..."; // example client package

// Without providing the endpoint, a "No valid endpoint provider available." error will be thrown
const individualClient = new $SERVICEClient({
  // string
  endpoint: "https://www.example.com",
});
```

See [the section on customizations via `TypeScriptIntegration` for more details](#customizations-via-typescriptintegration).

#### Publishing a Client SDK package

> Note: There is no prescribed way to publish NPM packages since there are many ways to maintain SDKs. Some publishing tools include using [`npm publish`](https://docs.npmjs.com/cli/v8/commands/npm-publish) or [`yarn publish`](https://classic.yarnpkg.com/lang/en/docs/cli/publish/) directly, or managing a monorepo with tools like [`turbo`](https://turbo.build/repo/docs/handbook/publishing-packages). This section provides tips for how a general publishing workflow could work.

A generated client is a package that is ready to be published. After running `smithy build`, the generated client artifacts will be in the build directory under the projection and plugin name. For example, generated client artifacts for the source projection using the `typescript-client-codegen` plugin in a Smithy CLI project would be in the `build/smithy/source/typescript-client-codegen/` directory. A common practice is to copy the generated client artifacts into a source control repository. After the artifacts are staged, any modifications that are needed prior to publishing the generated client artifacts specific to the SDK should be run, e.g. adding a `README.md`, editing changelog entries. Finally, with a chosen publishing tool for the SDK, publish the artifacts after running the `prepack` script per client package.

### Server SDK code generation: `typescript-server-codegen` plugin

For documentation of `typescript-server-codegen` artifacts and implementation, see [the Smithy TypeScript Server SDK walkthrough](https://smithy.io/2.0/languages/typescript/ts-ssdk/index.html) and [Developer Preview announcement blog post](https://aws.amazon.com/blogs/devops/smithy-server-and-client-generator-for-typescript).

#### `typescript-server-codegen` plugin configuration

> Note: Although plugin configuration is maintained with backward compatibility in mind, breaking changes may still occur.

[`TypeScriptSettings`](smithy-typescript-codegen/src/main/java/software/amazon/smithy/typescript/codegen/TypeScriptSettings.java) contains all of the settings enabled from `smithy-build.json` and helper methods and types. The up-to-date list of top-level properties enabled for `typescript-server-codegen` can be found in `TypeScriptSettings.ArtifactType.SSDK`.

| Setting                    | Required | Description                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package`                  | Yes      | Name of the package in `package.json`.                                                                                                                                                                                                                                                                                                                           |
| `packageVersion`           | Yes      | Version of the package in `package.json`.                                                                                                                                                                                                                                                                                                                        |
| `packageDescription`       | No       | Description of the package in `package.json`. The default value is `${package} server`.                                                                                                                                                                                                                                                                          |
| `packageJson`              | No       | Custom `package.json`properties that will be merged with the base `package.json`. The default value is an empty object.                                                                                                                                                                                                                                          |
| `packageManager`           | No       | Configured package manager for the package. The default value is `yarn`.                                                                                                                                                                                                                                                                                         |
| `service`                  | No       | The Shape ID of the service to generate a client for. If not provided, the code generator will attempt to infer the service Shape ID. If there is exactly 1 service found in the model, then the service is used as the inferred Shape ID. If no services are found, then code generation fails. If more than 1 service is found, then code generation fails.    |
| `protocol`                 | No       | The Shape ID of the protocol used to generate serialization and deserialization. If not provided, the code generator will attempt to resolve the highest priority service protocol supported in code generation (registered through `TypeScriptIntegration`). If no protocols are found, code generation will use serialization and deserialization error stubs. |
| `private`                  | No       | Whether the package is `private` in `package.json`. The default value is `false`.                                                                                                                                                                                                                                                                                |
| `requiredMemberMode`       | No       | **NOT RECOMMENDED DUE TO BACKWARD COMPATIBILITY CONCERNS.** Sets whether members marked with the `@required` trait are allowed to be `undefined`. See more details on the risks in `TypeScriptSettings.RequiredMemberMode`. The default value is `nullable`.                                                                                                     |
| `createDefaultReadme`      | No       | Whether to generate a default `README.md` for the package. The default value is `false`.                                                                                                                                                                                                                                                                         |
| `disableDefaultValidation` | No       | Whether or not default validation is disabled. See [the documentation for Smithy TypeScript SSDK validation](https://smithy.io/2.0/languages/typescript/ts-ssdk/validation.html) to learn more. The default value is `false`.                                                                                                                                    |

### Adding customizations to Smithy TypeScript

#### Using third-party packages

Third-party packages may provide implementations and integrations for code generation, and can be consumed like any other Java dependency. For example, [AWS SDK for JavaScript v3](https://github.com/aws/aws-sdk-js-v3) implements AWS customizations, protocols, and other utilities used for code generating the SDK, and can be consumed by importing the `software.amazon.smithy.typescript:smithy-aws-typescript-codegen` package.

In an idiomatic Smithy CLI project, the dependency can be added similar to how the core `smithy-typescript-codegen` dependency is added in [the section using Smithy TypeScript with the Smithy CLI](#using-smithy-typescript-with-the-smithy-cli).

In a Gradle project, the dependency can be added similar to how the core `smithy-typescript-codegen` dependency is added in [the section using Smithy TypeScript with Gradle](#using-smithy-typescript-with-gradle).

If a third-party package does not publish artifacts to an external code repository (e.g. Maven), the code may need to be built from source and published to the build environment's Maven Local Repository, typically through a command similar to `./gradlew publishToMavenLocal`.

> Note: Currently there is no utility to remove or disable integrations that are loaded. If a third-party package's integration has behavior that is not expected (e.g. customizing without reacting to the model, settings, or feature flags), it may be an sign that the underlying implementation does not follow best practices.

#### Customizations via `TypeScriptIntegration`

Smithy TypeScript code generation can be customized by implementing [the `TypeScriptIntegration` interface](smithy-typescript-codegen/src/main/java/software/amazon/smithy/typescript/codegen/integration/TypeScriptIntegration.java), which also extends [the `SmithyIntegration` interface](https://github.com/smithy-lang/smithy/blob/main/smithy-codegen-core/src/main/java/software/amazon/smithy/codegen/core/SmithyIntegration.java). These integrations are typically implemented and packaged in Java Gradle projects that depend on `smithy-typescript-codegen` (for the `TypeScriptIntegration` interface) and built as consumable Java libraries.

Each `TypeScriptIntegration` implementation consists of two paired changes:

- An implementation of `TypeScriptIntegration`, and

  ```java
  // src/main/java/example/smithy/typescript/integration/ExampleSmithyTypeScriptIntegration.java

  package example.smithy.typescript.integration;

  // Import the TypeScriptIntegration interface
  import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;

  public final class ExampleSmithyTypeScriptIntegration implements TypeScriptIntegration {
    // Implement TypeScriptIntegration or SmithyIntegration methods, e.g. SmithyIntegration::customize
  }
  ```

- A corresponding entry in the service loader for `TypeScriptIntegration`

  ```java
  // src/main/resources/META-INF/services/software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration
  // Note that entry is the canonical name of the implemented TypeScriptIntegration
  // To add more integrations, add an entry per line

  example.smithy.typescript.integration.ExampleSmithyTypeScriptIntegration
  ```

Once the Java libary is built, the library can be [consumed as a third-party package](#using-third-party-packages), and the integrations will automatically be loaded via [Java SPI](https://docs.oracle.com/javase/tutorial/ext/basics/spi.html).

The easiest way to see how the individual methods on `TypeScriptIntegration` (and by extension `SmithyIntegration`) are used in the code generation process is by searching by usage at a given Smithy TypeScript version, as method usages are subject to change.

> Note: if an existing integration point does not exist on `TypeScriptIntegration` or `SmithyIntegration`, check if [the `RuntimeClientPlugin` abstraction](smithy-typescript-codegen/src/main/java/software/amazon/smithy/typescript/codegen/integration/RuntimeClientPlugin.java) has an integration point. If not, [create a feature request](https://github.com/smithy-lang/smithy-typescript/issues/new) with the incompatible use case.

> Note: Although the `TypeScriptIntegration` interface is maintained with backward compatibility in mind, the interface may be subject to breaking changes as it is annotated with `@SmithyUnstableApi`. Methods may also have additional individual annotations that should be noted (e.g. `@SmithyInternalApi`).

An example of a Java Gradle project that provides customizations can be found in [`smithy-typescript-codegen-test/example-weather-customizations`](smithy-typescript-codegen-test/example-weather-customizations).

#### TypeScript client configuration

During code generation, code generators should provide a default value for each client's input configuration property through a client's runtime configuration. If there are use cases in which configuration may need a specific set of values (e.g. specific features like using HTTP/2), writing a `RuntimeExtension` that has those specific configuration property values may make sense.

For example, a team that publishes a client for the `Weather` service in a package named `@example/weather` may write and publish a `RuntimeExtension` that provides the configuration values needed to use HTTP/2 with the service:

```typescript
// Http2HandlerRuntimeExtension.ts published in package @example/weather-http-2-runtime-extension

import { RuntimeExtension, WeatherExtensionConfiguration } from "@example/weather";
import { NodeHttp2Handler } from "@smithy/node-http-handler";

export class Http2HandlerRuntimeExtension implements RuntimeExtension {
  configure(extensionConfiguration: WeatherExtensionConfiguration): void {
    console.log("Enabling HTTP/2");
    extensionConfiguration.setHttpHandler(new NodeHttp2Handler());
  }
}
```

Then customers can opt-in to using the extension at runtime using the `extensions` configuration property:

```typescript
import { WeatherClient } from "@example/weather";
import { Http2HandlerRuntimeExtension } from "@example/weather-http-2-runtime-extension";

const client = new WeatherClient({
  extensions: [new Http2HandlerRuntimeExtension()],
});
```

For more documentation, see [the `typescript-client-codegen` section](#client-sdk-code-generation-typescript-client-codegen-plugin).

## Local Development

This repository is in developer preview, so local changes may be needed to both build and test the code generators.

See [the contributing guide](CONTRIBUTING.md) for more details.

### Using local code generation changes

Smithy TypeScript code generators depend on Smithy and the Smithy Gradle Plugin, and will by default use the version specified in `gradle.properties`. Any changes to dependencies require recursively republishing dependent packages.

```text
Dependents of Smithy TypeScript
└──Smithy TypeScript
   ├── Smithy
   └── Smithy Gradle Plugin
```

For simplicity, only Smithy and Smithy TypeScript instructions are documented.

> Note: the Smithy Gradle Plugin is under heavy development, so it may be difficult to test different versions.

#### Smithy

If using local [Smithy](https://github.com/smithy-lang/smithy) changes, build `software.amazon.smithy.*` packages and publish the packages to a Maven Local Repository:

```shell
git clone https://github.com/smithy-lang/smithy.git
cd smithy
# Make intended changes, e.g. checking out a certain commit
./gradlew publishToMavenLocal
```

Then, update the `gradle.properties` property `smithyVersion` in the Smithy TypeScript repository locally to the artifacts' version if different than the current `smithyVersion`.

#### Smithy TypeScript

If using local Smithy TypeScript changes, build the `software.amazon.smithy.typescript.*` packages and publish them to a Maven Local Repository:

```shell
git clone https://github.com/smithy-lang/smithy-typescript.git
cd smithy-typescript
# Make intended changes, e.g. bumping the codegen artifact version
./gradlew publishToMavenLocal
```

Then, update the dependent package code to depend on the published version if different than the current version.

### TypeScript packages changes

All TypeScript packages are included in a [Yarn](https://yarnpkg.com/) workspace at the root of the repository:

- Smithy Client SDK packages are in the `packages/` directory, and
- Smithy Server SDK packages are in the `smithy-typescript-ssdk-libs/` directory.

At the root of the repository, scripts defined in the root `package.json` are managed by [Turbo](https://turbo.build/). Commonly used commands during development include:

- `yarn build`: build all of the packages in the repository
- `yarn test`: run the unit tests of all of the packages in the repository
- `yarn test:integration`: build test clients in `smithy-typescript-codegen-test` via the `build-generated-test-packages.js` script, and then run the integration tests of all of the packages in the repository

Each individual package will have at least the `build` script, and may have the `test` and `test:integration` scripts.

For Smithy Client SDK packages, changelogs and versioning are managed by [`changesets`](https://github.com/changesets/changesets). When making changes to these package, a changeset file will need to be added via `yarn changeset add` with an appropriate changelog message and version bump. See [the contribution guide](CONTRIBUTING.md#contributing-via-pull-requests) for more details.

### Testing

For both code generation and TypeScript package changes, unit tests and integration tests needs to pass.

- To run tests for TypeScript packages, run the following at the root level: `yarn test`.
- To run tests for code generation, run the following at the root level: `./gradlew clean build check`.
- To run integration tests that test both code generation and TypeScript packages using the test clients in `smithy-typescript-codegen-test`, run the following at the root level: `yarn test:integration`.

All of these checks will also run in GitHub actions when submitting a pull request or merging to `main`.

#### Updating `smithy-typescript-codegen-test` models

The `smithy-typescript-codegen-test` contains test models that test whether TypeScript packages compile correctly and code generated.

These models can be edited to test additional traits, integrations, and settings, but new projections and smithy models can also be added to test changes in isolation.

To use a generated artifact in an integration test, update the `build-generated-test-packages.js` file to build and copy the generated artifacts to `node_modules/`. Then, import the package like any other dependency in `*.integ.spec.ts` test files.

### Troubleshooting

Many Gradle issues can be fixed by stopping the Gradle daemon by running `./gradlew --stop`.

## License

This library is licensed under the Apache 2.0 License.
