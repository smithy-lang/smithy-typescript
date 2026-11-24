import { resolve } from "node:path";

import { runProjection } from "./lib/run-projection";

const projection = process.argv[2] ?? "my-local-model-schema";
const fixtureDir = resolve(__dirname, "../test/fixtures", projection);

runProjection(projection, fixtureDir).then(({ summary }) => {
  console.log(
    `identical ${summary.identical.length}, different ${summary.different.length}, ` +
      `missing ${summary.missing.length}, extra ${summary.extra.length}`
  );
});
