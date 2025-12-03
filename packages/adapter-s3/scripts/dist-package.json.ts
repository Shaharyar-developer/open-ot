import fs from "fs";

const src = JSON.parse(fs.readFileSync("./package.json", "utf8"));
const out = {
 name: src.name,
  version: src.version,
  dependencies: src.dependencies,
  peerDependencies: src.peerDependencies,
  main: "index.js",
  types: "index.d.ts",
  files: ["*"],
  exports: {
    ".": {
      import: "./index.js",
      types: "./index.d.ts",
    },
  },
};

fs.writeFileSync("./dist/package.json", JSON.stringify(out, null, 2));
