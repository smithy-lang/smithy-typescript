.PHONY: local test build

# used with another locally situated consuming codebase to test changes.
local:
	./gradlew clean build publishToMavenLocal

build:
	./gradlew build

# run tests
test:
	./gradlew test