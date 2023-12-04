/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

tasks["jar"].enabled = false

val smithyVersion: String by project
val version: String by project

buildscript {
    val smithyVersion: String by project

    repositories {
        mavenCentral()
    }
    dependencies {
        "classpath"("software.amazon.smithy:smithy-cli:$smithyVersion")
    }
}

plugins {
    id("software.amazon.smithy")
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("software.amazon.smithy.typescript:smithy-typescript-codegen:$version!!")
    implementation("software.amazon.smithy.typescript:smithy-aws-typescript-codegen:$version!!")
    implementation(project(":smithy-typescript-codegen-test"))
    implementation(project(":smithy-typescript-codegen-test:example-weather-customizations"))
}
