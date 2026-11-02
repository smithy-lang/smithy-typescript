.PHONY: run socket-timeout

run:
	npm install
	node ./s3-get-object.mjs

# Manual only, not part of test-e2e: GetObject with an unread body against real S3.
socket-timeout:
	npm install
	node ./s3-socket-timeout.mjs
