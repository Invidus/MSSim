import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");
const VERSION = process.env.MSSIM_VERSION || "0.9.0-rc1";

const COPY_PATHS = ["index.html", "src", "assets"];

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

if (existsSync(DIST)) {
  rmSync(DIST, { recursive: true, force: true });
}
mkdirSync(DIST, { recursive: true });

for (const p of COPY_PATHS) {
  const dest = join(DIST, p);
  const src = join(ROOT, p);
  if (!existsSync(src)) {
    console.warn("Skip missing:", p);
    continue;
  }
  const st = statSync(src);
  if (st.isDirectory()) {
    copyTree(p, p);
  } else {
    mkdirSync(join(dest, ".."), { recursive: true });
    cpSync(src, dest);
  }
}

const files = walkFiles(DIST);
const totalBytes = files.reduce((acc, f) => acc + f.bytes, 0);
const builtAt = new Date().toISOString();

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
