/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import java.io.FileInputStream
import java.nio.charset.StandardCharsets.UTF_8

rootProject.name = "smithy-typescript"
include(":smithy-typescript-codegen")
include(":smithy-typescript-codegen-test")
include(":smithy-typescript-protocol-test-codegen")
include(":smithy-typescript-codegen-test:example-weather-customizations")
include(":smithy-typescript-codegen-test:released-version-test")
include(":smithy-typescript-ssdk-codegen-test-utils")

file(
    java.nio.file.Paths
        .get(rootProject.projectDir.absolutePath, "local.properties"),
).takeIf { it.isFile }
    ?.let { f ->
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
    val smithyGradleVersion: String by settings
    plugins {
        id("software.amazon.smithy.gradle.smithy-jar").version(smithyGradleVersion)
        id("software.amazon.smithy.gradle.smithy-base").version(smithyGradleVersion)
    }

    repositories {
        mavenLocal()
        mavenCentral()
        gradlePluginPortal()
    }
}
