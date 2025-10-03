import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { BundlerSizeBenchmarker } from "./BundlerSizeBenchmarker.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const applicationFolder = path.join(__dirname, "..", "applications");

for (const app of fs.readdirSync(applicationFolder)) {
  if (fs.lstatSync(path.join(applicationFolder, app)).isDirectory()) {
    continue;
  }
  const benchmarker = new BundlerSizeBenchmarker({ application: app });

  const stat = await benchmarker.all();
  console.log(stat);
}
