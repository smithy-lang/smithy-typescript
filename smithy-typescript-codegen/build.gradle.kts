/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
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
        "classpath"("software.amazon.smithy:smithy-cli:$smithyVersion")
    }
}

dependencies {
    api("software.amazon.smithy:smithy-codegen-core:$smithyVersion")
    api("software.amazon.smithy:smithy-model:$smithyVersion")
    api("software.amazon.smithy:smithy-rules-engine:$smithyVersion")
    api("software.amazon.smithy:smithy-waiters:$smithyVersion")
    implementation("software.amazon.smithy:smithy-protocol-test-traits:$smithyVersion")
}

sourceSets {
    main {
        resources {
            setSrcDirs(listOf("src/main/resources", "$buildDir/generated/resources"))
        }
    }
}

tasks.register("set-dependency-versions") {
    doLast {
        mkdir("$buildDir/generated/resources/software/amazon/smithy/typescript/codegen")
        var versionsFile =
                file("$buildDir/generated/resources/software/amazon/smithy/typescript/codegen/dependencyVersions.properties")
        var roots = project.file("../packages").listFiles().toMutableList() + project.file("../smithy-typescript-ssdk-libs").listFiles().toList()
        roots.forEach { packageDir ->
            var packageJsonFile = File(packageDir, "package.json")
            if (packageJsonFile.isFile()) {
                var packageJson = Node.parse(packageJsonFile.readText()).expectObjectNode()
                var packageName = packageJson.expectStringMember("name").getValue()
                var packageVersion = packageJson.expectStringMember("version").getValue()
                var isPrivate = packageJson.getBooleanMemberOrDefault("private", false)
                if (!isPrivate) {
                    versionsFile.appendText("$packageName=$packageVersion\n")
                }
            }
        }
    }
}

tasks["processResources"].dependsOn(tasks["set-dependency-versions"])
