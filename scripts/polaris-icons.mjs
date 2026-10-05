#!/usr/bin/env node
// Polaris placeholder icon generator. Replace the art by editing `tile()` or by dropping in final files.
//   node scripts/polaris-icons.mjs            write every icon file
//   node scripts/polaris-icons.mjs --sheet <out.png>   write a review sheet only (no repo files)
// The three channels share one base icon. Dev and nightly add a corner badge so they can be told apart.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const P_OUTER = "M14 8h24c10 0 17 7.6 17 19s-7 19-17 19H24v12H14V8Z";
const P_COUNTER = "M24 18v18h14c4.4 0 7-3.6 7-9s-2.6-9-7-9H24Z";
const fatStar = (cx, cy, r, k = 0.14) => {
  const c = r * k;
  return `M${cx} ${cy - r}Q${cx + c} ${cy - c} ${cx + r} ${cy}Q${cx + c} ${cy + c} ${cx} ${cy + r}Q${cx - c} ${cy + c} ${cx - r} ${cy}Q${cx - c} ${cy - c} ${cx} ${cy - r}Z`;
};

const DEFS = `<defs>
  <linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#10b585"/><stop offset="1" stop-color="#005f47"/></linearGradient>
  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d3f7ea"/></linearGradient>
  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#8ff0c8"/></linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#d6fff0" stop-opacity=".6"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></radialGradient>
  <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>`;

const BACKGROUND = `
  <rect width="100" height="100" rx="22.37" fill="url(#g)"/>
  <rect width="100" height="100" rx="22.37" fill="url(#gl)"/>
  <rect x="0.5" y="0.5" width="99" height="99" rx="21.9" fill="none" stroke="#fff" stroke-opacity="0.14"/>
  <g fill="#fff"><circle cx="16" cy="84" r="0.8" opacity=".5"/><circle cx="86" cy="86" r="0.7" opacity=".45"/><circle cx="12" cy="40" r="0.6" opacity=".4"/><circle cx="84" cy="14" r="0.6" opacity=".4"/></g>`;

const GW = 41;
const GH = 50;
function pStarMark() {
  const gs = 1.02;
  const gx = (100 - GW * gs) / 2 - 14 * gs;
  const gy = (100 - GH * gs) / 2 - 8 * gs;
  return `<g transform="translate(${gx} ${gy}) scale(${gs})">
    <path fill-rule="evenodd" fill="url(#pg)" d="${P_OUTER} ${P_COUNTER}"/>
    <circle cx="34.5" cy="27" r="11" fill="url(#glow)" opacity=".5"/>
    <path fill="url(#sg)" d="${fatStar(34.5, 27, 7)}"/>
  </g>`;
}

function starMark() {
  return `<circle cx="50" cy="50" r="36" fill="url(#glow)"/>
  <path fill="url(#pg)" d="${fatStar(50, 50, 29, 0.16)}"/>`;
}

// Corner badges: dev = amber chip with </>, nightly = indigo chip with a crescent. Prod has none.
function badge(channel) {
  if (channel === "dev") {
    return `<g>
      <circle cx="77" cy="77" r="16.6" fill="#fff" fill-opacity="0.96"/>
      <circle cx="77" cy="77" r="14.2" fill="#f59e0b"/>
      <g fill="none" stroke="#3a2300" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M71.7 71.7L66.4 77l5.3 5.3"/><path d="M82.3 71.7L87.6 77l-5.3 5.3"/><path d="M79.3 70.8L74.7 83.2"/>
      </g></g>`;
  }
  if (channel === "nightly") {
    return `<g>
      <mask id="moon"><rect width="100" height="100" fill="#fff"/><circle cx="80.4" cy="74.2" r="6.4" fill="#000"/></mask>
      <circle cx="77" cy="77" r="16.6" fill="#fff" fill-opacity="0.96"/>
      <circle cx="77" cy="77" r="14.2" fill="#5b5bd6"/>
      <circle cx="76" cy="78" r="7.8" fill="#fff" mask="url(#moon)"/>
    </g>`;
  }
  return "";
}

export function tile({ channel = "prod", mark = "p" } = {}) {
  return `${DEFS}${BACKGROUND}${mark === "star" ? starMark() : pStarMark()}${badge(channel)}`;
}

// canvas: full icon size. body: [x, y, size] of the squircle inside it.
function iconSvg({ canvas, body, shadow, channel, mark }) {
  const [bx, by, bs] = body;
  const rx = bs * 0.2237;
  const shadowDefs = shadow
    ? `<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="${canvas * 0.014}"/><feOffset dy="${canvas * 0.012}" result="b"/><feComponentTransfer><feFuncA type="linear" slope="0.38"/></feComponentTransfer></filter>`
    : "";
  const shadowUse = shadow
    ? `<rect x="${bx}" y="${by}" width="${bs}" height="${bs}" rx="${rx}" fill="#000" filter="url(#sh)"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">
  <defs>${shadowDefs}</defs>${shadowUse}
  <svg x="${bx}" y="${by}" width="${bs}" height="${bs}" viewBox="0 0 100 100">${tile({ channel, mark })}</svg>
</svg>`;
}

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
const fullBleed = (channel, mark) =>
  iconSvg({ canvas: 1024, body: [0, 0, 1024], shadow: false, channel, mark });
const macSvg = (channel, mark) =>
  iconSvg({ canvas: 1024, body: [100, 100, 824], shadow: true, channel, mark });

function makeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = 6 + 16 * entries.length;
  const dirs = [];
  const datas = [];
  for (const { size, data } of entries) {
    const d = Buffer.alloc(16);
    d.writeUInt8(size >= 256 ? 0 : size, 0);
    d.writeUInt8(size >= 256 ? 0 : size, 1);
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(data.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += data.length;
    dirs.push(d);
    datas.push(data);
  }
  return Buffer.concat([header, ...dirs, ...datas]);
}
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

// At 24 px and below the P-with-star mark blurs (the star fills the counter), so those favicon
// sizes use the star alone. The Windows app icon keeps the full mark at every size.
const markForFavicon = (size) => (size <= 24 ? "star" : "p");

const CHANNELS = {
  dev: {
    dir: "assets/dev",
    ios: "blueprint-ios-1024.png",
    mac: "blueprint-macos-1024.png",
    uni: "blueprint-universal-1024.png",
    touch: "blueprint-web-apple-touch-180.png",
    f16: "blueprint-web-favicon-16x16.png",
    f32: "blueprint-web-favicon-32x32.png",
    fico: "blueprint-web-favicon.ico",
    win: "blueprint-windows.ico",
  },
  nightly: {
    dir: "assets/nightly",
    ios: "nightly-ios-1024.png",
    mac: "nightly-macos-1024.png",
    uni: "nightly-universal-1024.png",
    touch: "nightly-web-apple-touch-180.png",
    f16: "nightly-web-favicon-16x16.png",
    f32: "nightly-web-favicon-32x32.png",
    fico: "nightly-web-favicon.ico",
    win: "nightly-windows.ico",
  },
  prod: {
    dir: "assets/prod",
    ios: "black-ios-1024.png",
    mac: "black-macos-1024.png",
    uni: "black-universal-1024.png",
    touch: "t3-black-web-apple-touch-180.png",
    f16: "t3-black-web-favicon-16x16.png",
    f32: "t3-black-web-favicon-32x32.png",
    fico: "t3-black-web-favicon.ico",
    win: "t3-black-windows.ico",
  },
};

async function renderChannel(channel) {
  const fav = (size) => png(fullBleed(channel, markForFavicon(size)), size);
  const full = (size) => png(fullBleed(channel, "p"), size);
  const faviconIco = makeIco(
    await Promise.all(ICO_SIZES.map(async (size) => ({ size, data: await fav(size) }))),
  );
  const windowsIco = makeIco(
    await Promise.all(ICO_SIZES.map(async (size) => ({ size, data: await full(size) }))),
  );
  return {
    ios: await png(fullBleed(channel, "p"), 1024),
    mac: await png(macSvg(channel, "p"), 1024),
    uni: await png(fullBleed(channel, "p"), 1024),
    touch: await full(180),
    f16: await fav(16),
    f32: await fav(32),
    faviconIco,
    windowsIco,
  };
}

async function writeAll() {
  const written = [];
  const put = (rel, buf) => {
    const target = join(repoRoot, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, buf);
    written.push(rel);
  };
  for (const [channel, c] of Object.entries(CHANNELS)) {
    const r = await renderChannel(channel);
    put(`${c.dir}/${c.ios}`, r.ios);
    put(`${c.dir}/${c.mac}`, r.mac);
    put(`${c.dir}/${c.uni}`, r.uni);
    put(`${c.dir}/${c.touch}`, r.touch);
    put(`${c.dir}/${c.f16}`, r.f16);
    put(`${c.dir}/${c.f32}`, r.f32);
    put(`${c.dir}/${c.fico}`, r.faviconIco);
    put(`${c.dir}/${c.win}`, r.windowsIco);
    if (channel === "dev") {
      // The app's public favicon and splash use the development exports (assets/README.md).
      put("apps/web/public/apple-touch-icon.png", r.touch);
      put("apps/web/public/favicon-16x16.png", r.f16);
      put("apps/web/public/favicon-32x32.png", r.f32);
      put("apps/web/public/favicon.ico", r.faviconIco);
    }
  }
  put(
    "assets/prod/logo.svg",
    Buffer.from(
      `<svg fill="none" xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 100 100">${tile({ channel: "prod" })}</svg>\n`,
    ),
  );
  console.log(`wrote ${written.length} files`);
}

async function writeSheet(out) {
  const tileSize = 256;
  const pad = 20;
  const rowHeight = tileSize + 150;
  const cols = ["prod", "dev", "nightly"];
  const marks = ["p", "star"];
  const layers = [];
  const zoom = async (small, size) =>
    sharp(small)
      .resize(size * 4, size * 4, { kernel: "nearest" })
      .png()
      .toBuffer();
  for (const [row, mark] of marks.entries()) {
    for (const [col, channel] of cols.entries()) {
      const x = pad + col * (tileSize + pad);
      const y = pad + row * rowHeight;
      const s16 = await png(fullBleed(channel, mark === "p" ? markForFavicon(16) : mark), 16);
      const s32 = await png(fullBleed(channel, mark === "p" ? markForFavicon(32) : mark), 32);
      layers.push({ input: await png(macSvg(channel, mark), tileSize), left: x, top: y });
      layers.push({ input: await zoom(s16, 16), left: x, top: y + tileSize + 10 });
      layers.push({ input: await zoom(s32, 32), left: x + 76, top: y + tileSize + 10 });
      layers.push({ input: s32, left: x + 214, top: y + tileSize + 10 });
      layers.push({ input: s16, left: x + 222, top: y + tileSize + 52 });
    }
  }
  const width = pad + cols.length * (tileSize + pad);
  const height = pad + marks.length * rowHeight;
  await sharp({ create: { width, height, channels: 4, background: "#ececec" } })
    .composite(layers)
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}

const args = process.argv.slice(2);
if (args[0] === "--sheet") await writeSheet(resolve(args[1]));
else await writeAll();
