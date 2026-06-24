/**
 * Стилизованные SVG-иллюстрации для витрины «Имущество».
 * @param {string} visual
 * @param {number} tier
 * @param {string} accent
 * @param {number} [size]
 */
export function renderLuxuryVisual(visual, tier, accent = "#7a4cff", size = 96) {
  const t = Math.max(1, Math.min(6, Math.round(Number(tier) || 1)));
  const a = accent || "#7a4cff";
  const body =
    visual === "realty"
      ? realtySvg(t, a)
      : visual === "aviation"
        ? aviationSvg(t, a)
        : visual === "yacht"
          ? yachtSvg(t, a)
          : visual === "art"
            ? artSvg(t, a)
            : visual === "watches"
              ? watchSvg(t, a)
              : visual === "islands"
                ? islandSvg(t, a)
                : autoSvg(t, a);

  return `<svg class="luxury-visual" width="${size}" height="${size}" viewBox="0 0 96 96" aria-hidden="true">${body}</svg>`;
}

function autoSvg(tier, accent) {
  const glow = tier >= 5 ? `<ellipse cx="48" cy="78" rx="34" ry="6" fill="${accent}" opacity="0.25"/>` : "";
  const spoiler = tier >= 5 ? `<path d="M18 52 L12 46 L84 46 L78 52 Z" fill="${accent}" opacity="0.7"/>` : "";
  const stripe = tier >= 4 ? `<path d="M28 58 L68 58" stroke="${accent}" stroke-width="2" opacity="0.8"/>` : "";
  const wheelR = tier <= 1 ? 7 : 9;
  return `
    <rect width="96" height="96" rx="12" fill="#181b23"/>
    <rect x="8" y="8" width="80" height="80" rx="10" fill="#1f2330" stroke="#2b2e3a"/>
    ${glow}
    <path d="M16 56 Q20 38 34 34 L62 34 Q76 38 80 56 L78 62 L18 62 Z" fill="${accent}" opacity="${0.55 + tier * 0.06}"/>
    <path d="M22 42 L74 42 L70 34 L26 34 Z" fill="#2b3142"/>
    ${spoiler}
    ${stripe}
    <circle cx="28" cy="62" r="${wheelR}" fill="#111318" stroke="#4a5068" stroke-width="2"/>
    <circle cx="68" cy="62" r="${wheelR}" fill="#111318" stroke="#4a5068" stroke-width="2"/>
    <circle cx="28" cy="62" r="3" fill="#6a7088"/>
    <circle cx="68" cy="62" r="3" fill="#6a7088"/>
    ${tier <= 1 ? `<circle cx="48" cy="48" r="14" fill="none" stroke="${accent}" stroke-width="3"/><circle cx="48" cy="48" r="4" fill="${accent}"/>` : ""}
  `;
}

function realtySvg(tier, accent) {
  const floors = Math.min(5, tier);
  const h = 12 + floors * 10;
  const y = 72 - h;
  const windows = Array.from({ length: floors }, (_, i) => {
    const wy = y + 8 + i * 10;
    return `<rect x="36" y="${wy}" width="10" height="8" rx="1" fill="#ffe9a8" opacity="0.85"/><rect x="50" y="${wy}" width="10" height="8" rx="1" fill="#ffe9a8" opacity="0.55"/>`;
  }).join("");
  const roof =
    tier >= 5
      ? `<rect x="30" y="${y - 8}" width="36" height="8" fill="${accent}"/><rect x="38" y="${y - 14}" width="20" height="6" fill="${accent}" opacity="0.8"/>`
      : `<polygon points="48,${y - 10} 22,${y + 2} 74,${y + 2}" fill="${accent}" opacity="0.85"/>`;
  const pool = tier >= 6 ? `<rect x="14" y="74" width="22" height="6" rx="2" fill="#5ec8e8" opacity="0.7"/>` : "";
  return `
    <rect width="96" height="96" rx="12" fill="#181b23"/>
    <rect x="8" y="8" width="80" height="80" rx="10" fill="#1a2030" stroke="#2b2e3a"/>
    <rect x="10" y="72" width="76" height="14" rx="2" fill="#252836"/>
    ${pool}
    ${roof}
    <rect x="28" y="${y}" width="40" height="${h}" rx="2" fill="${accent}" opacity="${0.45 + tier * 0.05}"/>
    ${windows}
    <rect x="42" y="${y + h - 14}" width="12" height="14" fill="#3a3040"/>
  `;
}

function aviationSvg(tier, accent) {
  const span = 28 + tier * 6;
  return `
    <rect width="96" height="96" rx="12" fill="#181b23"/>
    <rect x="8" y="8" width="80" height="80" rx="10" fill="#1a2238" stroke="#2b2e3a"/>
    <ellipse cx="48" cy="72" rx="40" ry="8" fill="#252836"/>
    <path d="M${48 - span} 52 L48 36 L${48 + span} 52 L${48 + span - 8} 56 L48 48 L${48 - span + 8} 56 Z" fill="${accent}" opacity="0.75"/>
    <ellipse cx="48" cy="50" rx="${14 + tier * 2}" ry="8" fill="${accent}" opacity="0.9"/>
    <path d="M48 42 L48 28" stroke="${accent}" stroke-width="3"/>
    <path d="M40 44 L30 38 M56 44 L66 38" stroke="#8a9bb5" stroke-width="2"/>
    ${tier >= 3 ? `<circle cx="48" cy="50" r="3" fill="#fff" opacity="0.9"/>` : ""}
  `;
}

function yachtSvg(tier, accent) {
  const len = 50 + tier * 8;
  const mast = tier >= 2 ? `<line x1="58" y1="28" x2="58" y2="52" stroke="#d8dae3" stroke-width="2"/><path d="M58 30 L72 38 L58 42 Z" fill="#fff" opacity="0.8"/>` : "";
  const deck = tier >= 3 ? `<rect x="34" y="38" width="28" height="6" rx="1" fill="#e8d4a8" opacity="0.8"/>` : "";
  return `
    <rect width="96" height="96" rx="12" fill="#181b23"/>
    <rect x="8" y="8" width="80" height="80" rx="10" fill="#142030" stroke="#2b2e3a"/>
    <path d="M8 68 Q48 62 88 68 L88 76 Q48 70 8 76 Z" fill="#1e3a5a" opacity="0.5"/>
    <path d="M${48 - len / 2} 58 L${48 + len / 2} 58 L${48 + len / 2 - 10} 68 L${48 - len / 2 + 10} 68 Z" fill="${accent}" opacity="0.85"/>
    ${deck}
    ${mast}
    <ellipse cx="48" cy="74" rx="36" ry="5" fill="#0e1828" opacity="0.6"/>
  `;
}

function artSvg(tier, accent) {
  const frame = tier >= 4 ? 6 : 4;
  const abstract =
    tier >= 3
      ? `<circle cx="42" cy="46" r="10" fill="${accent}" opacity="0.6"/><path d="M36 58 Q48 50 60 58" stroke="#ff8f8f" stroke-width="3" fill="none"/>`
      : `<rect x="36" y="40" width="24" height="18" fill="${accent}" opacity="0.4"/>`;
  return `
    <rect width="96" height="96" rx="12" fill="#181b23"/>
    <rect x="8" y="8" width="80" height="80" rx="10" fill="#221e18" stroke="#2b2e3a"/>
    <rect x="24" y="26" width="48" height="44" rx="2" fill="#3a3020" stroke="${accent}" stroke-width="${frame}"/>
    <rect x="30" y="32" width="36" height="32" fill="#f5efe6"/>
    ${abstract}
    ${tier >= 5 ? `<circle cx="58" cy="38" r="4" fill="#ffd700"/>` : ""}
  `;
}

function watchSvg(tier, accent) {
  const gems = tier >= 5 ? `<circle cx="48" cy="30" r="2" fill="#fff"/><circle cx="58" cy="36" r="1.5" fill="#fff"/><circle cx="38" cy="36" r="1.5" fill="#fff"/>` : "";
  return `
    <rect width="96" height="96" rx="12" fill="#181b23"/>
    <rect x="8" y="8" width="80" height="80" rx="10" fill="#1a1a22" stroke="#2b2e3a"/>
    <rect x="30" y="22" width="10" height="14" rx="2" fill="${accent}" opacity="0.7"/>
    <rect x="56" y="22" width="10" height="14" rx="2" fill="${accent}" opacity="0.7"/>
    <circle cx="48" cy="50" r="${16 + tier}" fill="none" stroke="${accent}" stroke-width="${tier >= 4 ? 4 : 3}"/>
    <circle cx="48" cy="50" r="${10 + tier * 0.5}" fill="#12141c" stroke="#4a5068"/>
    <line x1="48" y1="50" x2="48" y2="42" stroke="#fff" stroke-width="2"/>
    <line x1="48" y1="50" x2="54" y2="52" stroke="${accent}" stroke-width="2"/>
    ${gems}
  `;
}

function islandSvg(tier, accent) {
  const w = 28 + tier * 6;
  const palms =
    tier >= 2
      ? `<path d="M${48 - w / 3} 42 Q${48 - w / 3 - 6} 28 ${48 - w / 3} 22" stroke="#5a9a4a" stroke-width="2" fill="none"/><circle cx="${48 - w / 3}" cy="22" r="7" fill="#6bcf7f" opacity="0.85"/>`
      : "";
  const villa =
    tier >= 2
      ? `<rect x="${48 - 8}" y="36" width="16" height="10" rx="1" fill="#f5efe6" opacity="0.9"/><polygon points="${48},32 ${40},36 ${56},36" fill="${accent}" opacity="0.8"/>`
      : "";
  const runway =
    tier >= 4
      ? `<rect x="14" y="58" width="68" height="4" rx="1" fill="#4a5068" opacity="0.7"/><line x1="18" y1="60" x2="78" y2="60" stroke="#fff" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>`
      : "";
  const flag =
    tier >= 5
      ? `<line x1="${48 + w / 4}" y1="28" x2="${48 + w / 4}" y2="40" stroke="#d8dae3" stroke-width="1.5"/><path d="M${48 + w / 4} 28 L${48 + w / 4 + 10} 31 L${48 + w / 4} 34 Z" fill="${accent}"/>`
      : "";
  const extraIslands =
    tier >= 3
      ? `<ellipse cx="22" cy="62" rx="10" ry="5" fill="${accent}" opacity="0.45"/><ellipse cx="74" cy="64" rx="8" ry="4" fill="${accent}" opacity="0.35"/>`
      : "";
  return `
    <rect width="96" height="96" rx="12" fill="#181b23"/>
    <rect x="8" y="8" width="80" height="80" rx="10" fill="#0e2030" stroke="#2b2e3a"/>
    <path d="M8 72 Q48 58 88 72 L88 84 Q48 70 8 84 Z" fill="#1a4a6a" opacity="0.55"/>
    ${extraIslands}
    <ellipse cx="48" cy="58" rx="${w / 2}" ry="${8 + tier * 2}" fill="${accent}" opacity="${0.55 + tier * 0.06}"/>
    <ellipse cx="48" cy="54" rx="${w / 2 - 4}" ry="${5 + tier}" fill="#5ec8a8" opacity="0.35"/>
    ${palms}
    ${villa}
    ${runway}
    ${flag}
  `;
}
