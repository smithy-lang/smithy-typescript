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
	node ./scripts/post-protocol-test-codegen
	npx prettier --write ./private/smithy-rpcv2-cbor
	yarn

test-protocols:
	(cd ./private/smithy-rpcv2-cbor && npx vitest run --globals)

turbo-clean:
	@read -p "Are you sure you want to delete your local cache? [y/N]: " ans && [ $${ans:-N} = y ]
	@echo "\nDeleted cache folders: \n--------"
	@find . -name '.turbo' -type d -prune -print -exec rm -rf '{}' + && echo '\n'