## Smithy Typescript

Smithy code generators for TypeScript.

**WARNING: All interfaces are subject to change.**

## Generating a client

This repository builds TypeScript declarations and JavaScript clients from Smithy
models.

The `smithy-typescript-codegen-test` package in this repos is an example of
how to build a TypeScript client. The steps needed to build a TypeScript client
are as follows:

1. Create a new directory for your package. For example, "foo-client".
2. Create a `build.gradle.kts` file with the following contents:

   ```kotlin
    buildscript {
        repositories {
            mavenCentral()
        }
        dependencies {
            "classpath"("software.amazon.smithy:smithy-cli:[1.33.0,1.34.0[")
        }
    }

    plugins {
        id("software.amazon.smithy").version("0.6.0")
    }

    repositories {
        mavenLocal()
        mavenCentral()
    }

    dependencies {
        implementation("software.amazon.smithy:smithy-model:[1.33.0,1.34.0[")
        implementation("software.amazon.smithy.typescript:smithy-typescript-codegen:0.17.1")
    }
   ```

3. Create a `smithy-build.json` file with the following contents,
   substituting "smithy.example#ExampleService" with the name of the service
   to generate and "smithyexample" with the name of the TypeScript package to
   create.:

   ```json
    {
        "version": "1.0",
        "plugins": {
            "typescript-codegen": {
                "service": "smithy.example#ExampleService",
                "targetNamespace": "SmithyExample",
                "package": "smithyexample",
                "packageVersion": "0.0.1",
                "packageJson": {
                    "license": "Apache-2.0"
                }
            }
        }
    }

   ```

4. Create a directory named `model`. This is where all of your Smithy models
   will go.

5. Create a file in the `model` directory named `main.smithy` with the following contents:

    ```
    $version: "2"
   
    namespace smithy.example

    service ExampleService {
        version: "2022-01-01"
        operations: [Echo]
    }

    operation Echo {
        input := {
            message: String
        } 
        output := {
            message: String
        }
    }
    ```

6. Run `gradle build` (alternatively, you can use a
   [Gradle wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html)).

7. The generated client can be found in `build/smithyprojections/foo-client/source/typescript-codegen`.

See [the Smithy documentation](https://smithy.io/2.0/guides/building-models/gradle-plugin.html)
for more information on build Smithy projects with Gradle.

## TypeScript code generation

TODO

## Steps to build

This repo is under heavy development. You will need to use unreleased
features to build.

First, build software.amazon.smithy.* packages and publish them
to Maven local:

- `git clone https://github.com/awslabs/smithy.git`
- `cd smithy`
- `./gradlew publishToMavenLocal`
- `cd ..`
- `git clone https://github.com/awslabs/smithy-typescript.git`
- `cd smithy-typescript`
- `./gradlew build`

If you're consuming `smithy` or `smithy-typescript` and have already published
locally, run the following command to publish the newest contents in your local
repository:
 - `./gradlew clean publishToMavenLocal`

You can find the build artifacts of the test package at:
`build/smithyprojections/smithy-typescript-codegen-test/source/typescript-codegen`

## Troubleshooting

Many Gradle issues can be fixed by stopping the daemon by running `./gradlew --stop`

## License

This library is licensed under the Apache 2.0 License.
