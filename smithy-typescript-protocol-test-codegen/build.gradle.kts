import software.amazon.smithy.gradle.tasks.SmithyBuild

val smithyVersion: String by project

repositories {
    mavenLocal()
    mavenCentral()
}

buildscript {
    val smithyVersion: String by project
    dependencies {
        classpath("software.amazon.smithy:smithy-cli:$smithyVersion")
    }
}

plugins {
    id("software.amazon.smithy").version("0.6.0")
}

dependencies {
    implementation("software.amazon.smithy:smithy-protocol-tests:$smithyVersion")
    implementation(project(":smithy-typescript-codegen"))
}

// This project doesn't produce a JAR.
tasks["jar"].enabled = false

tasks["smithyBuildJar"].enabled = false

tasks.create<SmithyBuild>("buildSdk") {
    addRuntimeClasspath = true
}

// Run the `buildSdk` automatically.
tasks["build"].finalizedBy(tasks["buildSdk"])
