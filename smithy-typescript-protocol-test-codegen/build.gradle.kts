import software.amazon.smithy.gradle.tasks.SmithyBuildTask

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
    `java-library`

    val smithyGradleVersion: String by project
    id("software.amazon.smithy.gradle.smithy-base").version(smithyGradleVersion)
}

dependencies {
    implementation("software.amazon.smithy:smithy-protocol-tests:$smithyVersion")
    implementation(project(":smithy-typescript-codegen"))
}

val buildSdk = tasks.register<SmithyBuildTask>("buildSdk") {
    models.set(files("model/"))
    smithyBuildConfigs.set(files("smithy-build.json"))
}

// Run the `buildSdk` automatically.
tasks["build"].finalizedBy(buildSdk)

tasks.register<Sync>("copyOutput") {
    into(layout.buildDirectory.dir("model"))
    from(buildSdk.map { it.getPluginProjectionDirectory("source", "model") })
}