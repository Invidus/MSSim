/**
 * Zip ассетов для карточки игры в консоли ЯИ (обложки + скриншоты, без runtime).
 * Запуск: npm run package:store
 */
import { execSync } from "child_process";
import { existsSync, readFileSync, mkdirSync, rmSync, cpSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const STORE = join(ROOT, "assets/store");
const STAGING = join(ROOT, ".store-upload");
const manifestPath = join(ROOT, "src/data/build_manifest.json");

const STORE_FILES = [
  "icon-512.png",
  "cover-800x470.png",
  "cover-hero-1560x520.png",
  "screenshot-kpi.png",
  "screenshot-stock.png",
  "screenshot-progression.png",
];

if (!existsSync(STORE)) {
  console.error("assets/store не найден");
  process.exit(1);
}

let version = "1.0.0";
try {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.version) version = manifest.version;
} catch (_) {
  /* default */
}

if (existsSync(STAGING)) rmSync(STAGING, { recursive: true, force: true });
mkdirSync(STAGING, { recursive: true });

for (const file of STORE_FILES) {
  const src = join(STORE, file);
  if (!existsSync(src)) {
    console.warn("Skip missing:", file);
    continue;
  }
  cpSync(src, join(STAGING, file));
}

const outName = `mssim-v${version}-store-assets.zip`;
const outPath = join(ROOT, outName);
if (existsSync(outPath)) rmSync(outPath);

const stagingGlob = join(STAGING, "*").replace(/\\/g, "/");
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${stagingGlob}' -DestinationPath '${outPath.replace(/\\/g, "/")}' -Force"`,
  { stdio: "inherit" }
);
rmSync(STAGING, { recursive: true, force: true });
console.log(`Store assets: ${outName}`);
