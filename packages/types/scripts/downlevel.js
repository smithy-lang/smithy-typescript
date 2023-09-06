const fs = require("fs");
const path = require("path");

const pkgRoot = path.join(__dirname, "..");

function replaceDownlevelFile(pathFromSrc = "") {
  const code = fs.readFileSync(path.join(pkgRoot, "dist-types", "ts3.4", "downlevel-ts3.4", pathFromSrc), "utf-8");
  fs.writeFileSync(path.join(pkgRoot, "dist-types", "ts3.4", pathFromSrc), code, "utf-8");
}

replaceDownlevelFile("transform/type-transform.d.ts");
