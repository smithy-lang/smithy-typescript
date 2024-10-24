.PHONY: build sync

build:
	./gradlew clean build publishToMavenLocal

sync:
	gh repo sync $$GITHUB_USERNAME/smithy-typescript -b main
	git fetch --all

generate-protocol-tests:
	./gradlew :smithy-typescript-protocol-test-codegen:build
	rm -rf ./private/smithy-rpcv2-cbor
	cp -r ./smithy-typescript-protocol-test-codegen/build/smithyprojections/smithy-typescript-protocol-test-codegen/smithy-rpcv2-cbor/typescript-codegen ./private/smithy-rpcv2-cbor
	cp ./packages/core/vitest.config.ts ./private/smithy-rpcv2-cbor/vitest.config.js
	node ./scripts/post-protocol-test-codegen
	npx prettier --write ./private/smithy-rpcv2-cbor
	yarn

test-protocols:
	(cd ./private/smithy-rpcv2-cbor && npx vitest run --globals)