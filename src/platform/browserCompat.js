/**
 * @param {object} [cfg]
 */
export function runBrowserCompatChecks(cfg = {}) {
  const optional = new Set(cfg.optionalApis || ["clipboard", "structuredClone"]);
  const checks = [
    { id: "localStorage", label: "localStorage", pass: testLocalStorage(), required: true },
    { id: "fetch", label: "fetch API", pass: typeof fetch === "function", required: true },
    { id: "promise", label: "Promise", pass: typeof Promise !== "undefined", required: true },
    { id: "json", label: "JSON", pass: typeof JSON !== "undefined" && typeof JSON.parse === "function", required: true },
    { id: "es-modules", label: "ES modules", pass: true, required: true },
    {
      id: "clipboard",
      label: "Clipboard API",
      pass: typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function",
      required: false,
    },
    {
      id: "structuredClone",
      label: "structuredClone",
      pass: typeof structuredClone === "function",
      required: false,
    },
  ];

  const normalized = checks.map((c) => ({
    ...c,
    required: c.required !== false && !optional.has(c.id),
  }));
  const requiredFails = normalized.filter((c) => c.required && !c.pass);
  const passCount = normalized.filter((c) => c.pass).length;
  const supported = requiredFails.length === 0;

  return {
    supported,
    passCount,
    totalChecks: normalized.length,
    requiredFails: requiredFails.map((c) => c.id),
    checks: normalized,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };
}

function testLocalStorage() {
  try {
    const k = "__mssim_ls_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch (_) {
    return false;
  }
}

import { applyPlayerUiMode, resolveUiMode } from "./playerUi.js";

/**
 * @param {object} manifest
 */
export function applyReleaseUiMode(manifest) {
  applyPlayerUiMode(resolveUiMode(manifest));
}
