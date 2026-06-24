/**
 * Создаёт zip для загрузки в консоль Яндекс Игр из папки dist/.
 * Запуск: npm run build && npm run package
 */
import { execSync } from "child_process";
import { existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");
const manifestPath = join(ROOT, "src/data/build_manifest.json");

if (!existsSync(DIST)) {
  console.error("dist/ не найден. Сначала выполните: npm run build");
  process.exit(1);
}

let version = "1.0.0";
try {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.version) version = manifest.version;
} catch (_) {
  /* use default */
}

const outName = `mssim-v${version}-yandex.zip`;
const outPath = join(ROOT, outName);

if (existsSync(outPath)) rmSync(outPath);

const distGlob = join(DIST, "*").replace(/\\/g, "/");
const cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${distGlob}' -DestinationPath '${outPath.replace(/\\/g, "/")}' -Force"`;
execSync(cmd, { stdio: "inherit" });
console.log(`Package ready: ${outName}`);
