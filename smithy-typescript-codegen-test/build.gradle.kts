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

extra["displayName"] = "Smithy :: Typescript :: Codegen :: Test"
extra["moduleName"] = "software.amazon.smithy.typescript.codegen.test"

tasks["jar"].enabled = false

buildscript {
    repositories {
        mavenCentral()
    }
    dependencies {
        "classpath"("software.amazon.smithy:smithy-cli:${rootProject.extra["smithyVersion"]}")
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
    implementation(project(":smithy-typescript-codegen"))
    implementation("software.amazon.smithy:smithy-waiters:${rootProject.extra["smithyVersion"]}")
    implementation("software.amazon.smithy:smithy-protocol-test-traits:${rootProject.extra["smithyVersion"]}")
}
