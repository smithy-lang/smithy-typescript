extra["displayName"] = "Smithy :: Typescript :: SSDK :: Codegen :: Test :: Utils"
extra["moduleName"] = "software.amazon.smithy.typescript.ssdk.codegen.test.utils"

val smithyVersion: String by project

buildscript {
    val smithyVersion: String by project

    repositories {
        mavenLocal()
        mavenCentral()
    }
    dependencies {
        "classpath"("software.amazon.smithy:smithy-cli:$smithyVersion")
    }
}

plugins {
    val smithyGradleVersion: String by project

    id("software.amazon.smithy").version(smithyGradleVersion)
}

repositories {
    mavenLocal()
    mavenCentral()
}

dependencies {
    implementation(project(":smithy-typescript-codegen"))
    implementation("software.amazon.smithy:smithy-model:$smithyVersion")
}