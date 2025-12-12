/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import software.amazon.smithy.model.node.Node

description = "Generates TypeScript code from Smithy models"
extra["displayName"] = "Smithy :: Typescript :: Codegen"
extra["moduleName"] = "software.amazon.smithy.typescript.codegen"

val smithyVersion: String by project

buildscript {
    val smithyVersion: String by project

    repositories {
        mavenCentral()
    }

    dependencies {
        classpath("software.amazon.smithy:smithy-model:$smithyVersion")
    }
}

dependencies {
    val smithyVersion: String by project

    // Smithy generic dependencies
    api("software.amazon.smithy:smithy-codegen-core:$smithyVersion")
    api("software.amazon.smithy:smithy-model:$smithyVersion")
    api("software.amazon.smithy:smithy-protocol-traits:$smithyVersion")
    api("software.amazon.smithy:smithy-protocol-test-traits:$smithyVersion")
    api("software.amazon.smithy:smithy-rules-engine:$smithyVersion")
    api("software.amazon.smithy:smithy-waiters:$smithyVersion")
}

sourceSets {
    main {
        resources {
            setSrcDirs(
                listOf(
                    "src/main/resources",
                    layout.buildDirectory
                        .dir("generated/resources")
                        .get()
                        .asFile,
                ),
            )
        }
    }
}

abstract class SetDependencyVersionsTask : DefaultTask() {
    @get:InputDirectory
    abstract val packagesDir: DirectoryProperty

    @get:InputDirectory
    abstract val smithyTsSsdkLibs: DirectoryProperty

    @get:OutputFile
    abstract val versionsFile: RegularFileProperty

    @TaskAction
    fun execute() {
        val outputFile = versionsFile.get().asFile
        outputFile.parentFile.mkdirs()
        outputFile.printWriter().close()

        val roots =
            packagesDir
                .get()
                .asFile
                .listFiles()
                .toMutableList() +
                smithyTsSsdkLibs
                    .get()
                    .asFile
                    .listFiles()
                    .toList()
        roots.forEach { packageDir ->
            val packageJsonFile = File(packageDir, "package.json")
            if (packageJsonFile.isFile()) {
                val packageJson = Node.parse(packageJsonFile.readText()).expectObjectNode()
                val packageName = packageJson.expectStringMember("name").getValue()
                val packageVersion = packageJson.expectStringMember("version").getValue()
                val isPrivate = packageJson.getBooleanMemberOrDefault("private", false)
                if (!isPrivate) {
                    outputFile.appendText("$packageName=$packageVersion\n")
                }
            }
        }
    }
}

tasks.register<SetDependencyVersionsTask>("set-dependency-versions") {
    packagesDir.set(project.file("../packages"))
    smithyTsSsdkLibs.set(project.file("../smithy-typescript-ssdk-libs"))
    versionsFile.set(
        layout.buildDirectory.file("generated/resources/software/amazon/smithy/typescript/codegen/dependencyVersions.properties"),
    )
}

tasks["processResources"].dependsOn(tasks["set-dependency-versions"])
tasks["sourcesJar"].dependsOn(tasks["set-dependency-versions"])
