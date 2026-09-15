#!/usr/bin/env node
/**
 * Generates Google Play Store listing assets into play-store/.
 * Layout uses explicit safe-area math — no overlapping / cut-off elements.
 *
 * Run: node scripts/generate-play-store-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "play-store");
const WEB_ICON = path.join(ROOT, "..", "mentorforge", "public", "icon-512.png");

const BRAND = {
  surface: "#F9F8F6",
  onSurface: "#1C1B1A",
  brand: "#4A5D4E",
  brandSecondary: "#E8EBE9",
  muted: "#8A8782",
  border: "#E6E4DF",
  white: "#FFFFFF",
};

const TABLET_7 = { w: 1200, h: 1920, label: "tablet-7", tablet: true };
const TABLET_10 = { w: 1600, h: 2560, label: "tablet-10", tablet: true };
const PHONE = { w: 1080, h: 1920, tablet: false };

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Viewport-aware layout helper (base design width 1080). */
function L(w, h, { fullScreen = false } = {}) {
  const r = w / 1080;
  const px = (n) => Math.round(n * r);
  const tabH = px(80);
  const statusH = px(56);
  const bottomInset = px(28);
  const contentBottom = fullScreen ? h - bottomInset - px(88) : h - tabH - bottomInset;
  const pad = px(40);
  const gap = px(20);

  return {
    w,
    h,
    r,
    px,
    pad,
    gap,
    statusH,
    tabH,
    contentBottom,
    inner: w - pad * 2,
    fullScreen,
    serif: "Georgia, serif",
    sans: "system-ui, sans-serif",
  };
}

function svgOpen(L) {
  return `<svg width="${L.w}" height="${L.h}" viewBox="0 0 ${L.w} ${L.h}" xmlns="http://www.w3.org/2000/svg">`;
}

function svgClose() {
  return `</svg>`;
}

function statusBar(L) {
  const { px, pad, statusH, sans, onSurface = BRAND.onSurface } = { onSurface: BRAND.onSurface, ...L };
  return `
  <rect width="${L.w}" height="${statusH}" fill="${BRAND.surface}"/>
  <text x="${pad}" y="${px(36)}" font-family="${sans}" font-size="${px(24)}" font-weight="600" fill="${onSurface}">9:41</text>`;
}

function tabBar(L, active) {
  const { w, h, tabH, px, sans, serif } = L;
  const y = h - tabH;
  const tabs = ["Home", "Plan", "Profile"];
  const labels = tabs
    .map((t, i) => {
      const x = w * (0.17 + i * 0.33);
      const fill = i === active ? BRAND.brand : BRAND.muted;
      return `<text x="${x}" y="${y + px(48)}" text-anchor="middle" font-family="${serif}" font-size="${px(20)}" fill="${fill}">${t}</text>`;
    })
    .join("");
  return `
  <rect x="0" y="${y}" width="${w}" height="${tabH}" fill="${BRAND.white}"/>
  <line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${BRAND.border}" stroke-width="1"/>
  ${labels}
  <rect x="${w / 2 - px(110)}" y="${h - px(16)}" width="${px(220)}" height="${px(5)}" rx="3" fill="${BRAND.onSurface}" opacity="0.12"/>`;
}

function homeIndicator(L) {
  const { w, h, px } = L;
  return `<rect x="${w / 2 - px(110)}" y="${h - px(16)}" width="${px(220)}" height="${px(5)}" rx="3" fill="${BRAND.onSurface}" opacity="0.12"/>`;
}

function pill(x, y, w, h, text, { bg = BRAND.brandSecondary, fg = BRAND.brand, fs = 20, sans }) {
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${bg}"/>
  <text x="${x + w / 2}" y="${y + h * 0.68}" text-anchor="middle" font-family="${sans}" font-size="${fs}" font-weight="600" fill="${fg}">${esc(text)}</text>`;
}

function btn(x, y, w, h, text, { sans, fs = 26 }) {
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(h * 0.22)}" fill="${BRAND.brand}"/>
  <text x="${x + w / 2}" y="${y + h * 0.64}" text-anchor="middle" font-family="${sans}" font-size="${fs}" font-weight="600" fill="${BRAND.white}">${esc(text)}</text>`;
}

function card(x, y, w, h, { fill = BRAND.white, stroke = BRAND.border, sw = 2 } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(Math.min(w, h) * 0.04)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function progressRing(cx, cy, r, pct, { px, sans, stroke = 10 }) {
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${BRAND.border}" stroke-width="${stroke}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${BRAND.brand}" stroke-width="${stroke}" stroke-dasharray="${dash} ${circ}" transform="rotate(-90 ${cx} ${cy})"/>
  <text x="${cx}" y="${cy + px(6)}" text-anchor="middle" font-family="${sans}" font-size="${px(28)}" font-weight="600" fill="${BRAND.onSurface}">${Math.round(pct * 100)}%</text>`;
}

function screenHome(L, tablet) {
  const { w, pad, inner, px, gap, contentBottom, serif, sans } = L;
  let y = px(72);

  const header = `
  <text x="${pad}" y="${y + px(28)}" font-family="${sans}" font-size="${px(30)}" fill="${BRAND.muted}">Good morning, Alex</text>`;
  y += px(44);
  const dateLine = `<text x="${pad}" y="${y + px(36)}" font-family="${serif}" font-size="${px(44)}" font-weight="600" fill="${BRAND.onSurface}">Sunday, August 9</text>`;
  const levelPill = pill(w - pad - px(160), px(64), px(160), px(44), "Level II", { fs: px(20), sans });
  y += px(52);

  const narrative = `<text x="${pad}" y="${y + px(32)}" font-family="${serif}" font-size="${px(34)}" fill="${BRAND.onSurface}">You&apos;re on track for May.</text>`;
  y += px(42);
  const focus = `<text x="${pad}" y="${y + px(32)}" font-family="${serif}" font-size="${px(34)}" fill="${BRAND.onSurface}">Fixed Income is this week&apos;s focus.</text>`;
  y += px(48);
  const statusPill = pill(pad, y, px(150), px(40), "On track", { fs: px(18), sans });
  const days = `<text x="${pad + px(170)}" y="${y + px(28)}" font-family="${sans}" font-size="${px(22)}" fill="${BRAND.muted}">142 days to exam</text>`;
  y += px(56);

  const mainTop = y;
  const mainH = contentBottom - mainTop - gap;

  if (!tablet) {
    const weekH = Math.round(mainH * 0.55);
    const coachH = mainH - weekH - gap;
    const wx = pad;
    const wy = mainTop;

    const week = `
    ${card(wx, wy, inner, weekH)}
    <text x="${pad + px(24)}" y="${wy + px(36)}" font-family="${sans}" font-size="${px(16)}" font-weight="700" letter-spacing="2" fill="${BRAND.muted}">THIS WEEK · WEEK 12</text>
    <text x="${wx + px(24)}" y="${wy + px(88)}" font-family="${serif}" font-size="${px(40)}" fill="${BRAND.onSurface}">Fixed Income</text>
    <text x="${wx + px(24)}" y="${wy + px(128)}" font-family="${sans}" font-size="${px(22)}" fill="${BRAND.muted}">Aug 4–10</text>
    <text x="${wx + px(24)}" y="${wy + px(168)}" font-family="${sans}" font-size="${px(24)}" fill="${BRAND.onSurface}">6h logged · 12h target</text>
    ${progressRing(wx + inner - px(90), wy + px(100), px(56), 0.5, { px, sans })}
    ${btn(wx + px(24), wy + weekH - px(88), inner - px(48), px(64), "Log weekly hours", { sans, fs: px(24) })}`;

    const cy = mainTop + weekH + gap;
    const coach = `
    ${card(pad, cy, inner, coachH, { fill: BRAND.brandSecondary, stroke: BRAND.brandSecondary })}
    <text x="${pad + px(24)}" y="${cy + px(40)}" font-family="${sans}" font-size="${px(16)}" font-weight="700" letter-spacing="2" fill="${BRAND.brand}">CALENDAR COACH</text>
    <text x="${pad + px(24)}" y="${cy + px(88)}" font-family="${serif}" font-size="${px(30)}" fill="${BRAND.onSurface}">Find a free study window</text>
    <text x="${pad + px(24)}" y="${cy + px(128)}" font-family="${sans}" font-size="${px(22)}" fill="${BRAND.muted}">Sync your calendar to slot a session.</text>
    ${btn(pad + px(24), cy + coachH - px(88), px(260), px(56), "Sync calendar", { sans, fs: px(22) })}`;

    return header + dateLine + levelPill + narrative + focus + statusPill + days + week + coach;
  }

  // Tablet: two equal columns
  const colW = Math.floor((inner - gap) / 2);
  const colH = mainH;
  const leftX = pad;
  const rightX = pad + colW + gap;

  const left = `
  ${card(leftX, mainTop, colW, colH)}
  <text x="${leftX + px(24)}" y="${mainTop + px(36)}" font-family="${sans}" font-size="${px(16)}" font-weight="700" letter-spacing="2" fill="${BRAND.muted}">THIS WEEK · WEEK 12</text>
  <text x="${leftX + px(24)}" y="${mainTop + px(88)}" font-family="${serif}" font-size="${px(36)}" fill="${BRAND.onSurface}">Fixed Income</text>
  <text x="${leftX + px(24)}" y="${mainTop + px(128)}" font-family="${sans}" font-size="${px(22)}" fill="${BRAND.muted}">Aug 4–10 · 6h / 12h</text>
  ${progressRing(leftX + colW - px(80), mainTop + px(96), px(48), 0.5, { px, sans })}
  ${btn(leftX + px(24), mainTop + colH - px(80), colW - px(48), px(56), "Log hours", { sans, fs: px(22) })}`;

  const right = `
  ${card(rightX, mainTop, colW, colH, { fill: BRAND.brandSecondary, stroke: BRAND.brandSecondary })}
  <text x="${rightX + px(24)}" y="${mainTop + px(36)}" font-family="${sans}" font-size="${px(16)}" font-weight="700" letter-spacing="2" fill="${BRAND.brand}">CALENDAR COACH</text>
  <text x="${rightX + px(24)}" y="${mainTop + px(88)}" font-family="${serif}" font-size="${px(32)}" fill="${BRAND.onSurface}">Free window today</text>
  <text x="${rightX + px(24)}" y="${mainTop + px(132)}" font-family="${sans}" font-size="${px(28)}" fill="${BRAND.onSurface}">2:30 – 4:00 PM</text>
  <text x="${rightX + px(24)}" y="${mainTop + px(172)}" font-family="${sans}" font-size="${px(20)}" fill="${BRAND.muted}">Inside your availability.</text>
  ${btn(rightX + px(24), mainTop + px(200), px(220), px(52), "Sync calendar", { sans, fs: px(20) })}
  ${btn(rightX + px(24), mainTop + colH - px(80), colW - px(48), px(52), "Add to calendar", { sans, fs: px(20) })}`;

  return header + dateLine + levelPill + narrative + focus + statusPill + days + left + right;
}

function screenPlan(L, tablet) {
  const { w, pad, inner, px, gap, contentBottom, serif, sans } = L;
  let y = px(72);

  const title = `<text x="${pad}" y="${y + px(36)}" font-family="${serif}" font-size="${px(48)}" fill="${BRAND.onSurface}">Your plan</text>`;
  const sub = `<text x="${pad}" y="${y + px(76)}" font-family="${sans}" font-size="${px(24)}" fill="${BRAND.muted}">Level II · 12h/week · 28 weeks</text>`;
  const ringX = w - pad - px(36);
  const ringY = y + px(36);
  const ring = `
  <circle cx="${ringX}" cy="${ringY}" r="${px(32)}" fill="none" stroke="${BRAND.border}" stroke-width="${px(5)}"/>
  <circle cx="${ringX}" cy="${ringY}" r="${px(32)}" fill="none" stroke="${BRAND.brand}" stroke-width="${px(5)}" stroke-dasharray="${px(100)} ${px(200)}" transform="rotate(-90 ${ringX} ${ringY})"/>
  <text x="${ringX}" y="${ringY + px(6)}" text-anchor="middle" font-family="${sans}" font-size="${px(18)}" font-weight="600" fill="${BRAND.onSurface}">43</text>`;

  y += px(100);
  const chips = ["All weeks", "Upcoming", "Completed"];
  let chipX = pad;
  const chipSvg = chips
    .map((c, i) => {
      const cw = px(i === 0 ? 140 : 150);
      const part = pill(chipX, y, cw, px(44), c, {
        bg: i === 0 ? BRAND.brand : BRAND.white,
        fg: i === 0 ? BRAND.white : BRAND.onSurface,
        fs: px(20),
        sans,
      });
      chipX += cw + px(12);
      return part;
    })
    .join("");

  y += px(64);
  const listTop = y;
  const listH = contentBottom - listTop;

  const weeks = [
    ["WEEK 11", "Equity Investments", "Done", BRAND.brandSecondary, BRAND.brand],
    ["WEEK 12", "Fixed Income", "Current", BRAND.brand, BRAND.white],
    ["WEEK 13", "Derivatives", "Next", "#F0EFEA", BRAND.muted],
    ["WEEK 14", "Alt Investments", "Next", "#F0EFEA", BRAND.muted],
  ];

  const cols = tablet ? 2 : 1;
  const rowGap = px(16);
  const colW = cols === 2 ? Math.floor((inner - gap) / 2) : inner;
  const rows = Math.ceil(weeks.length / cols);
  const cardH = Math.min(px(140), Math.floor((listH - rowGap * (rows - 1)) / rows));

  const cards = weeks
    .map(([label, topic, status, pbg, pfg], i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = pad + col * (colW + gap);
      const cy = listTop + row * (cardH + rowGap);
      const isCurrent = status === "Current";
      const pillW = px(status === "Done" ? 72 : status === "Current" ? 100 : 72);
      const topicFs = topic.length > 16 ? px(26) : px(30);
      const labelY = cy + px(28);
      const topicY = cy + px(88);
      return `
      ${card(x, cy, colW, cardH, { stroke: isCurrent ? BRAND.brand : BRAND.border, sw: isCurrent ? 2 : 1 })}
      <text x="${x + px(20)}" y="${labelY}" font-family="${sans}" font-size="${px(14)}" font-weight="700" letter-spacing="1.5" fill="${BRAND.muted}">${esc(label)}</text>
      ${pill(x + colW - pillW - px(16), cy + px(14), pillW, px(32), status, { bg: pbg, fg: pfg, fs: px(15), sans })}
      <text x="${x + px(20)}" y="${topicY}" font-family="${serif}" font-size="${topicFs}" fill="${BRAND.onSurface}">${esc(topic)}</text>`;
    })
    .join("");

  return title + sub + ring + chipSvg + cards;
}

function screenProfile(L) {
  const { w, pad, inner, px, gap, contentBottom, serif, sans } = L;
  const heroH = px(260);
  const hero = `
  <rect x="0" y="${px(56)}" width="${w}" height="${heroH}" fill="${BRAND.brandSecondary}"/>
  <circle cx="${w / 2}" cy="${px(56) + heroH / 2 - px(20)}" r="${px(56)}" fill="${BRAND.brand}"/>
  <text x="${w / 2}" y="${px(56) + heroH / 2 - px(4)}" text-anchor="middle" font-family="${serif}" font-size="${px(36)}" font-weight="600" fill="${BRAND.white}">AC</text>
  <text x="${w / 2}" y="${px(56) + heroH + px(28)}" text-anchor="middle" font-family="${serif}" font-size="${px(36)}" fill="${BRAND.onSurface}">Alex Chen</text>
  <text x="${w / 2}" y="${px(56) + heroH + px(64)}" text-anchor="middle" font-family="${sans}" font-size="${px(22)}" fill="${BRAND.muted}">alex@example.com</text>`;

  let y = px(56) + heroH + px(100);
  const subCard = `
  ${card(pad, y, inner, px(68), { fill: BRAND.onSurface, stroke: BRAND.onSurface })}
  <text x="${pad + px(20)}" y="${y + px(28)}" font-family="${sans}" font-size="${px(14)}" font-weight="700" letter-spacing="1.5" fill="${BRAND.brandSecondary}">FREE PLAN</text>
  <text x="${pad + px(20)}" y="${y + px(54)}" font-family="${serif}" font-size="${px(24)}" fill="${BRAND.white}">All Access — $99/yr</text>`;
  y += px(68) + gap;

  const rows = ["Availability & pacing", "Study sessions", "Reminders", "Privacy policy"];
  const rowH = px(72);
  const rowSvg = rows
    .map((label) => {
      const part = `
      ${card(pad, y, inner, rowH)}
      <text x="${pad + px(20)}" y="${y + rowH * 0.62}" font-family="${sans}" font-size="${px(24)}" fill="${BRAND.onSurface}">${esc(label)}</text>
      <text x="${pad + inner - px(16)}" y="${y + rowH * 0.62}" text-anchor="end" font-family="${sans}" font-size="${px(28)}" fill="${BRAND.muted}">›</text>`;
      y += rowH + gap;
      return part;
    })
    .join("");

  // Ensure last row fits above tab bar (y tracked)
  if (y > contentBottom) {
    throw new Error(`Profile layout overflow: ${y} > ${contentBottom}`);
  }

  return hero + subCard + rowSvg;
}

function screenOnboarding(L) {
  const { w, pad, inner, px, gap, contentBottom, serif, sans, h } = L;
  let y = px(80);

  const progress = `
  <text x="${pad}" y="${y}" font-family="${sans}" font-size="${px(20)}" fill="${BRAND.muted}">Step 1 of 4</text>`;
  y += px(28);
  const bar = `
  <rect x="${pad}" y="${y}" width="${px(180)}" height="${px(6)}" rx="3" fill="${BRAND.brand}"/>
  <rect x="${pad + px(180)}" y="${y}" width="${inner - px(180)}" height="${px(6)}" rx="3" fill="${BRAND.border}"/>`;
  y += px(48);
  const title = `<text x="${pad}" y="${y + px(32)}" font-family="${serif}" font-size="${px(44)}" fill="${BRAND.onSurface}">Which CFA level?</text>`;
  y += px(52);
  const blurb = `<text x="${pad}" y="${y + px(24)}" font-family="${sans}" font-size="${px(24)}" fill="${BRAND.muted}">We build a week-by-week plan for your exam.</text>`;
  y += px(56);

  const levels = [
    ["Level I", "Foundations across ten topic areas.", false],
    ["Level II", "Asset valuation in greater depth.", true],
    ["Level III", "Portfolio management & planning.", false],
  ];
  const cardH = px(120);
  const levelCards = levels
    .map(([t, b, sel]) => {
      const part = `
      ${card(pad, y, inner, cardH, { fill: sel ? BRAND.brandSecondary : BRAND.white, stroke: sel ? BRAND.brand : BRAND.border, sw: sel ? 2 : 1 })}
      <text x="${pad + px(24)}" y="${y + px(44)}" font-family="${serif}" font-size="${px(32)}" fill="${BRAND.onSurface}">${esc(t)}</text>
      <text x="${pad + px(24)}" y="${y + px(84)}" font-family="${sans}" font-size="${px(20)}" fill="${BRAND.muted}">${esc(b)}</text>
      ${sel ? `<circle cx="${pad + inner - px(28)}" cy="${y + cardH / 2}" r="${px(12)}" fill="${BRAND.brand}"/>` : ""}`;
      y += cardH + gap;
      return part;
    })
    .join("");

  const btnH = px(64);
  const btnY = Math.min(y + gap * 2, h - px(120) - btnH);
  const continueBtn = btn(pad, btnY, inner, btnH, "Continue", { sans, fs: px(26) });

  if (btnY + btnH > contentBottom + px(80)) {
    throw new Error(`Onboarding overflow at btnY=${btnY}`);
  }

  return progress + bar + title + blurb + levelCards + continueBtn;
}

function buildScreen(vp, kind, tab) {
  const layout = L(vp.w, vp.h, { fullScreen: kind === "onboarding" });
  let body;
  switch (kind) {
    case "home":
      body = screenHome(layout, vp.tablet);
      break;
    case "plan":
      body = screenPlan(layout, vp.tablet);
      break;
    case "profile":
      body = screenProfile(layout);
      break;
    case "onboarding":
      body = screenOnboarding(layout);
      break;
    default:
      throw new Error(kind);
  }

  const chrome =
    kind === "onboarding"
      ? statusBar(layout) + body + homeIndicator(layout)
      : statusBar(layout) + body + tabBar(layout, tab);

  return svgOpen(layout) + `<rect width="${layout.w}" height="${layout.h}" fill="${BRAND.surface}"/>` + chrome + svgClose();
}

async function renderSvg(svg, outPath) {
  await sharp(Buffer.from(svg)).png().toFile(outPath);
}

async function featureGraphic(iconPath) {
  const iconBuf = await sharp(iconPath).resize(280, 280).png().toBuffer();
  const accent = Buffer.from(`<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="500" fill="${BRAND.surface}"/>
    <rect width="380" height="500" fill="${BRAND.brand}"/>
    <text x="430" y="210" font-family="Georgia, serif" font-size="68" font-weight="600" fill="${BRAND.onSurface}">MentorForge</text>
    <text x="430" y="278" font-family="system-ui, sans-serif" font-size="30" fill="${BRAND.muted}">CFA study planning &amp; pacing</text>
    <text x="430" y="338" font-family="system-ui, sans-serif" font-size="26" font-weight="600" fill="${BRAND.brand}">Calendar-aware · Levels I, II &amp; III</text>
  </svg>`);
  await sharp(await sharp(accent).png().toBuffer())
    .composite([{ input: iconBuf, left: 50, top: 110 }])
    .png()
    .toFile(path.join(OUT, "feature-graphic-1024x500.png"));
}

const SCREEN_DEFS = [
  ["01-home", "home", 0],
  ["02-plan", "plan", 1],
  ["03-profile", "profile", 2],
  ["04-onboarding", "onboarding", -1],
];

async function writeSet(dir, prefix, vp) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [slug, kind, tab] of SCREEN_DEFS) {
    const svg = buildScreen(vp, kind, tab);
    const out = path.join(dir, `${prefix}-${slug}.png`);
    try {
      await renderSvg(svg, out);
    } catch (e) {
      throw new Error(`${slug}: ${e.message}`);
    }
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(WEB_ICON)) throw new Error(`Missing icon: ${WEB_ICON}`);

  await sharp(WEB_ICON).png().toFile(path.join(OUT, "icon-512.png"));
  await featureGraphic(WEB_ICON);

  await writeSet(OUT, "screenshot", PHONE);
  await writeSet(path.join(OUT, TABLET_7.label), "screenshot", TABLET_7);
  await writeSet(path.join(OUT, TABLET_10.label), "screenshot", TABLET_10);

  console.log("Generated play-store assets (layout v2):");
  const walk = (d, p = "") => {
    for (const f of fs.readdirSync(d).sort()) {
      const full = path.join(d, f);
      if (fs.statSync(full).isDirectory()) walk(full, `${p}${f}/`);
      else console.log(`  play-store/${p}${f}`);
    }
  };
  walk(OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
