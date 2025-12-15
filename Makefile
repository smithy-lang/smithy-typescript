.PHONY: build sync

build:
	./gradlew clean build publishToMavenLocal

sync:
	gh repo sync $$GITHUB_USERNAME/smithy-typescript -b main
	git fetch --all

generate-protocol-tests:
	rm -rf ./smithy-typescript-protocol-test-codegen/build/smithyprojections/smithy-typescript-protocol-test-codegen
	./gradlew :smithy-typescript-protocol-test-codegen:build
	rm -rf ./private/smithy-rpcv2-cbor
	rm -rf ./private/smithy-rpcv2-cbor-schema
	rm -rf ./private/my-local-model
	rm -rf ./private/my-local-model-schema
	cp -r ./smithy-typescript-protocol-test-codegen/build/smithyprojections/smithy-typescript-protocol-test-codegen/smithy-rpcv2-cbor/typescript-codegen ./private/smithy-rpcv2-cbor
	cp -r ./smithy-typescript-protocol-test-codegen/build/smithyprojections/smithy-typescript-protocol-test-codegen/smithy-rpcv2-cbor-schema/typescript-codegen ./private/smithy-rpcv2-cbor-schema
	cp -r ./smithy-typescript-protocol-test-codegen/build/smithyprojections/smithy-typescript-protocol-test-codegen/my-local-model/typescript-client-codegen/ ./private/my-local-model
	cp -r ./smithy-typescript-protocol-test-codegen/build/smithyprojections/smithy-typescript-protocol-test-codegen/my-local-model-schema/typescript-client-codegen/ ./private/my-local-model-schema
	node ./scripts/post-protocol-test-codegen
	yarn
	yarn turbo run build -F="./private/*" --only

test-protocols:
	(cd ./private/smithy-rpcv2-cbor && npx vitest run --globals && yarn test:index)
	(cd ./private/smithy-rpcv2-cbor-schema && npx vitest run --globals && yarn test:index)

# "build generate test"
bgt:
	make build generate-protocol-tests test-protocols

test-unit:
	yarn g:vitest run -c vitest.config.mts

test-browser:
	yarn g:vitest run -c vitest.config.browser.mts

test-bundlers:
	(cd ./testbed/bundlers && make run)

# typecheck for test code.
test-types:
	npx tsc -p tsconfig.test.json

test-integration:
	node ./scripts/validation/no-generic-byte-arrays.js
	node ./scripts/validation/api-snapshot-validation.js
	make test-browser
	yarn g:vitest run -c vitest.config.integ.mts
	make test-types

turbo-clean:
	@read -p "Are you sure you want to delete your local cache? [y/N]: " ans && [ $${ans:-N} = y ]
	@echo "\nDeleted cache folders: \n--------"
	@find . -name '.turbo' -type d -prune -print -exec rm -rf '{}' + && echo '\n'