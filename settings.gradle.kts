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

import java.io.FileInputStream
import java.nio.charset.StandardCharsets.UTF_8

rootProject.name = "smithy-typescript"
include(":smithy-typescript-codegen")
include(":smithy-typescript-codegen-test")
include(":smithy-typescript-codegen-test:example-weather-customizations")
include(":smithy-typescript-codegen-test:released-version-test")
include(":smithy-typescript-ssdk-codegen-test-utils")

file(
    java.nio.file.Paths.get(rootProject.projectDir.absolutePath, "local.properties"))
    .takeIf { it.isFile }?.let { f ->
        java.util.Properties().apply { load(java.io.InputStreamReader(FileInputStream(f), UTF_8)) }
    }?.run {
        listOf("smithy")
            .map { it to getProperty(it) }
            .filterNot { it.second.isNullOrEmpty() }
            .onEach { println("Found property `${it.first}`: ${it.second}") }
            .map { file(it.second) }
            .filter { it.isDirectory }
            .forEach { includeBuild(it.absolutePath) }
    }

pluginManagement {
    repositories {
        mavenLocal()
        mavenCentral()
        gradlePluginPortal()
    }
}
