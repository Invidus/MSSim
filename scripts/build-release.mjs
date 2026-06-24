import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");
const VERSION = process.env.MSSIM_VERSION || "1.0.0";

/** Папки в assets/, которые не попадают в release (тяжёлые PNG имущества). */
const ASSET_SKIP_DIRS = new Set(["luxury"]);

/** Store-ассеты только для консоли ЯИ — в runtime игры не нужны (кроме favicon). */
const STORE_SKIP_FILES = new Set([
  "cover-800x470.png",
  "cover-800x470.svg",
  "cover-hero-1560x520.png",
  "screenshot-kpi.png",
  "screenshot-kpi.svg",
  "screenshot-stock.png",
  "screenshot-stock.svg",
  "screenshot-progression.png",
  "screenshot-progression.svg",
  "icon-512.svg",
]);

function patchIndexCacheBuster(builtAt) {
  const tag = `${VERSION.replace(/\./g, "")}-${builtAt.slice(0, 10).replace(/-/g, "")}`;
  const indexPath = join(DIST, "index.html");
  if (existsSync(indexPath)) {
    let html = readFileSync(indexPath, "utf8");
    html = html.replace(/src\/app\.js\?v=[^"']+/, `src/app.js?v=${tag}`);
    writeFileSync(indexPath, html);
  }
  const srcIndex = join(ROOT, "index.html");
  if (existsSync(srcIndex)) {
    let srcHtml = readFileSync(srcIndex, "utf8");
    srcHtml = srcHtml.replace(/src\/app\.js\?v=[^"']+/, `src/app.js?v=${tag}`);
    writeFileSync(srcIndex, srcHtml);
  }
}

function walkFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkFiles(full, base));
    } else {
      out.push({
        path: relative(ROOT, full).replace(/\\/g, "/"),
        bytes: st.size,
      });
    }
  }
  return out;
}

function copyTree(srcRel, destRel) {
  const src = join(ROOT, srcRel);
  const dest = join(DIST, destRel);
  cpSync(src, dest, { recursive: true });
}

function copyAssetsForRelease() {
  const srcAssets = join(ROOT, "assets");
  const destAssets = join(DIST, "assets");
  if (!existsSync(srcAssets)) return;
  mkdirSync(destAssets, { recursive: true });
  for (const name of readdirSync(srcAssets)) {
    if (ASSET_SKIP_DIRS.has(name)) continue;
    if (name === "store") {
      const srcStore = join(srcAssets, "store");
      const destStore = join(destAssets, "store");
      mkdirSync(destStore, { recursive: true });
      for (const file of readdirSync(srcStore)) {
        if (STORE_SKIP_FILES.has(file)) continue;
        cpSync(join(srcStore, file), join(destStore, file));
      }
      continue;
    }
    copyTree(join("assets", name), join("assets", name));
  }
}

function stripLuxuryImagesInDist() {
  const luxuryPath = join(DIST, "src/data/luxury_items.json");
  if (!existsSync(luxuryPath)) return;
  const items = JSON.parse(readFileSync(luxuryPath, "utf8"));
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (item && typeof item === "object") delete item.image;
  }
  writeFileSync(luxuryPath, JSON.stringify(items, null, 2) + "\n");
}

if (existsSync(DIST)) {
  rmSync(DIST, { recursive: true, force: true });
}
mkdirSync(DIST, { recursive: true });

copyTree("index.html", "index.html");
copyTree("src", "src");
copyAssetsForRelease();
stripLuxuryImagesInDist();

const builtAt = new Date().toISOString();
patchIndexCacheBuster(builtAt);

const files = walkFiles(DIST);
const totalBytes = files.reduce((acc, f) => acc + f.bytes, 0);

const manifest = {
  version: VERSION,
  phase: 5,
  mode: "release",
  builtAt,
  totalBytes,
  fileCount: files.length,
  files: files.sort((a, b) => b.bytes - a.bytes).slice(0, 40),
};

writeFileSync(join(DIST, "build-manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(join(ROOT, "src/data/build_manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`MSSIM release build: ${VERSION}`);
console.log(`Output: ${DIST}`);
console.log(`Files: ${files.length}, size: ${(totalBytes / 1024).toFixed(1)} KB`);
if (totalBytes > 5 * 1024 * 1024) {
  console.warn(`WARN: size exceeds internal 5 MB gate (${(totalBytes / (1024 * 1024)).toFixed(2)} MB)`);
}
