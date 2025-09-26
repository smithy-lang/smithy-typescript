import assert from "node:assert";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const webpackDist = {
  name: "webpack",
  content: fs.readFileSync(path.join(__dirname, "dist", "webpack-dist.js"), "utf-8"),
};
const viteDist = {
  name: "vite",
  content: fs.readFileSync(path.join(__dirname, "dist", "vite-dist.js"), "utf-8"),
};

for (const { content: fileContents, name } of [webpackDist, viteDist]) {
  console.log("================", name, "================");

  const contentSize = fileContents.replaceAll(/\s+/g, "").length;
  const callsToClassBuilder = fileContents.match(/\.classBuilder\(\)/g) || [];

  const serializers = fileContents.match(/(var|const) se_/g) || [];
  const operationSchemas = fileContents.match(/ op\(/g) || [];
  const structSchemas = fileContents.match(/ struct\(/g) || [];

  console.log("serializers", serializers.length);
  console.log("operationSchemas", operationSchemas.length);
  console.log("structSchemas", structSchemas.length);
}
