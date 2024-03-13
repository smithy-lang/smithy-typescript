/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

plugins {
    java
    id("software.amazon.smithy.gradle.smithy-base")
}

repositories {
    mavenCentral()
}

dependencies {
    val smithyVersion: String by project
    val version: String by project

    smithyBuild("software.amazon.smithy.typescript:smithy-typescript-codegen:$version!!")
    smithyBuild("software.amazon.smithy.typescript:smithy-aws-typescript-codegen:$version!!")
    smithyBuild(project(":smithy-typescript-codegen-test:example-weather-customizations"))

    // Explicitly configure for CLI version
    smithyBuild("software.amazon.smithy:smithy-model:$smithyVersion")

    // Includes example model so must be runtime dependency
    implementation(project(":smithy-typescript-codegen-test"))
}

tasks["jar"].enabled = false
