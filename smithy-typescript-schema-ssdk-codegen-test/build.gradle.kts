/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

extra["displayName"] = "Smithy :: Typescript :: Schema :: SSDK :: Codegen :: Test"
extra["moduleName"] = "software.amazon.smithy.typescript.schema.ssdk.codegen.test"

plugins {
    `java-library`
    id("software.amazon.smithy.gradle.smithy-jar")
}

repositories {
    mavenLocal()
    mavenCentral()
}

dependencies {
    val smithyVersion: String by project

    smithyBuild(project(":smithy-typescript-codegen"))
    smithyBuild(project(":smithy-typescript-ssdk-codegen-test-utils"))

    implementation("software.amazon.smithy:smithy-aws-traits:$smithyVersion")
}
