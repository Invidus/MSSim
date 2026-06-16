/**
 * @param {object} [raw]
 */
export function normalizeBuildManifest(raw) {
  const b = raw && typeof raw === "object" ? raw : {};
  return {
    version: String(b.version || "dev"),
    phase: Number(b.phase) || 0,
    mode: String(b.mode || "development"),
    builtAt: b.builtAt || null,
    totalBytes: Math.max(0, Number(b.totalBytes) || 0),
    fileCount: Math.max(0, Number(b.fileCount) || 0),
    files: Array.isArray(b.files) ? b.files : [],
  };
}

/**
 * @param {object} manifest
 * @param {object} compat
 */
export function buildReleaseReadinessReport(manifest, compat) {
  const m = normalizeBuildManifest(manifest);
  const checks = [
    {
      id: "compat-required",
      label: "Обязательные API браузера",
      pass: compat?.supported === true,
    },
    {
      id: "build-manifest",
      label: "Release manifest (mode=release)",
      pass: m.mode === "release" && !!m.builtAt,
    },
    {
      id: "build-size",
      label: "Размер сборки <= 5 MB",
      pass: m.totalBytes > 0 && m.totalBytes <= 5 * 1024 * 1024,
    },
    {
      id: "file-count",
      label: "Файлов в сборке >= 10",
      pass: m.fileCount >= 10,
    },
    {
      id: "version-tag",
      label: "Версия не dev",
      pass: m.version !== "dev" && m.version.length > 0,
    },
  ];
  const passCount = checks.filter((c) => c.pass).length;
  const ratio = checks.length ? passCount / checks.length : 0;
  const decision = ratio >= 0.8 ? "READY" : ratio >= 0.6 ? "READY WITH RISKS" : "NOT READY";

  return {
    exportedAt: new Date().toISOString(),
    block: "81-82",
    phase: 5,
    decision,
    passCount,
    totalChecks: checks.length,
    checks,
    manifest: m,
    compat,
  };
}

export function formatBytes(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
