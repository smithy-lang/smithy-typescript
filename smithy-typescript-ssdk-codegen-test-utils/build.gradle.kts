extra["displayName"] = "Smithy :: Typescript :: SSDK :: Codegen :: Test :: Utils"
extra["moduleName"] = "software.amazon.smithy.typescript.ssdk.codegen.test.utils"

plugins {
    `java-library`
}

repositories {
    mavenLocal()
    mavenCentral()
}

dependencies {
    implementation(project(":smithy-typescript-codegen"))
}
