// electron-builder drops node_modules from extraResources, so copy the Next standalone server ourselves.
const fs = require("node:fs");
const path = require("node:path");

exports.default = async ({ appOutDir }) => {
  const dest = path.join(appOutDir, "resources", "app-server");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(path.join(__dirname, "..", ".next", "standalone"), dest, { recursive: true });
};
