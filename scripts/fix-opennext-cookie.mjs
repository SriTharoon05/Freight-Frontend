import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  ".open-next/middleware/handler.mjs",
  ".open-next/server-functions/default/handler.mjs",
  ".open-next/server-functions/default/index.mjs",
];

let patchedCount = 0;
for (const rel of targets) {
  const fullPath = path.resolve(projectRoot, rel);
  if (!existsSync(fullPath)) continue;
  const original = readFileSync(fullPath, "utf8");
  const updated = original
    .replaceAll("import_cookie.default.parse(", "(import_cookie.default ?? import_cookie).parse(")
    .replaceAll("import_cookie.default.serialize(", "(import_cookie.default ?? import_cookie).serialize(");
  if (updated !== original) {
    writeFileSync(fullPath, updated, "utf8");
    patchedCount += 1;
    console.log(`[fix-opennext-cookie] Patched ${rel}`);
  }
}
console.log(`[fix-opennext-cookie] Done (${patchedCount} file(s) updated).`);
