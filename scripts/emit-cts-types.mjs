// TypeScript resolves `*.d.cts` files for CommonJS consumers that use
// `moduleResolution: "node16"/"nodenext"`, so mirror every emitted `*.d.ts`
// as `*.d.cts` with corrected sourcemap references.
// (`tsc` itself only emits one extension per build.)
import { readdir, readFile, writeFile } from "node:fs/promises";

const files = (await readdir("dist")).filter((file) => file.endsWith(".d.ts"));

for (const file of files) {
  const ctsFile = file.replace(/\.d\.ts$/, ".d.cts");

  const declarations = await readFile(`dist/${file}`, "utf8");
  await writeFile(
    `dist/${ctsFile}`,
    declarations.replace(`${file}.map`, `${ctsFile}.map`),
  );

  const map = await readFile(`dist/${file}.map`, "utf8");
  await writeFile(
    `dist/${ctsFile}.map`,
    map.replace(`"file":"${file}"`, `"file":"${ctsFile}"`),
  );

  console.log(`mirrored dist/${file} -> dist/${ctsFile}`);
}
