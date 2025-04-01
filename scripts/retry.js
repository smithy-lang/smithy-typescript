#!/usr/bin/env node

const path = require("node:path");
const { spawnProcess } = require("./utils/spawn-process");

const [command, ...args] = process.argv.slice(process.argv.indexOf("--") + 1);

(async () => {
  const maxAttempts = 3;
  let attempt = 1;

  while (attempt++ <= maxAttempts) {
    try {
      await spawnProcess(command, args, {
        stdio: "inherit",
        cwd: path.join(__dirname, ".."),
      });
      break;
    } catch (e) {
      console.error("Command exited non-zero:", command, ...args);
      console.error(e);
      console.log(`Starting attempt: ${attempt}`);
    }
  }
})();
