// TypeScript resolves `dist/index.d.cts` for CommonJS consumers that use
// `moduleResolution: "node16"/"nodenext"`, so mirror the ESM declarations.
// (`tsc` itself only emits one extension per build.)
import { readFile, writeFile } from "node:fs/promises";

const declarations = "dist/index.d.ts";
const mapped = `${declarations}.map`;
const cjsDeclarations = "dist/index.d.cts";
const cjsMapped = `${cjsDeclarations}.map`;

const dts = await readFile(declarations, "utf8");
await writeFile(
  cjsDeclarations,
  dts.replace("index.d.ts.map", "index.d.cts.map"),
);

const map = await readFile(mapped, "utf8");
await writeFile(
  cjsMapped,
  map.replace('"file":"index.d.ts"', '"file":"index.d.cts"'),
);
