// Generates assets/icon.ico (multi-size Windows icon) and assets/icon.png from the web app's 512 px icon.
// Usage: npm run icon   (or: node scripts/make-icon.mjs [source.png])
// Resizing is done by Electron's nativeImage — Electron is a dev dependency anyway, so no image library is
// needed. Started with plain Node, the script re-runs itself inside Electron.
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(self), '..');
const DEFAULT_SOURCE = path.resolve(root, '..', 'respos-admin', 'public', 'pwa-512x512.png');

/** Sizes Windows asks for: small/large icons at 100–250 % scaling, the taskbar, Explorer's large views. */
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
/** From this size up an entry is stored as PNG (the Vista+ convention); smaller ones are classic 32-bit DIBs. */
const PNG_FROM = 256;

const insideElectron = process.versions.electron !== undefined && !process.env.ELECTRON_RUN_AS_NODE;
if (!insideElectron) {
  // `require('electron')` in plain Node is the path of the Electron binary.
  const electron = createRequire(import.meta.url)('electron');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(electron, [self, ...process.argv.slice(2)], { env, stdio: 'inherit' });
  if (result.error) console.error(result.error);
  process.exit(result.status ?? 1);
}

const { app, nativeImage } = await import('electron');

/** nativeImage.toBitmap() is BGRA with premultiplied alpha; an icon DIB stores straight alpha. */
function toStraightAlpha(premultiplied) {
  const pixels = Buffer.from(premultiplied);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3];
    if (alpha === 0 || alpha === 255) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      const value = pixels[offset + channel];
      if (value > alpha) throw new Error('Unexpected pixel data: the bitmap is not alpha-premultiplied');
      pixels[offset + channel] = Math.min(255, Math.round((value * 255) / alpha));
    }
  }
  return pixels;
}

/** One icon image as a device-independent bitmap: header, colour rows bottom-up, then the 1-bit AND mask. */
function dibEntry(image, size) {
  const pixels = toStraightAlpha(image.toBitmap());
  if (pixels.length !== size * size * 4) throw new Error(`Unexpected bitmap size for ${size} px`);
  const maskStride = Math.ceil(size / 32) * 4;
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight: colour + mask
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  header.writeUInt32LE(size * size * 4 + maskStride * size, 20); // biSizeImage

  const colour = Buffer.alloc(size * size * 4);
  const mask = Buffer.alloc(maskStride * size);
  for (let y = 0; y < size; y += 1) {
    const source = (size - 1 - y) * size * 4;
    pixels.copy(colour, y * size * 4, source, source + size * 4);
    for (let x = 0; x < size; x += 1) {
      if (pixels[source + x * 4 + 3] === 0) mask[y * maskStride + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return Buffer.concat([header, colour, mask]);
}

function buildIco(source) {
  const images = SIZES.map((size) => {
    const resized = source.resize({ width: size, height: size, quality: 'best' });
    const actual = resized.getSize();
    if (actual.width !== size || actual.height !== size) throw new Error(`Resize to ${size} px failed`);
    return { size, data: size >= PNG_FROM ? resized.toPNG() : dibEntry(resized, size) };
  });

  const directory = Buffer.alloc(6 + 16 * images.length);
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(images.length, 4);
  let offset = directory.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    directory.writeUInt8(size === 256 ? 0 : size, entry); // width (0 means 256)
    directory.writeUInt8(size === 256 ? 0 : size, entry + 1); // height
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([directory, ...images.map((image) => image.data)]);
}

async function main() {
  const sourceFile = path.resolve(process.argv.slice(2).find((argument) => argument.endsWith('.png')) ?? DEFAULT_SOURCE);
  const source = nativeImage.createFromPath(sourceFile);
  const { width, height } = source.getSize();
  if (source.isEmpty() || width !== height || width < 256) {
    throw new Error(`${sourceFile} must be a square PNG of at least 256 px (got ${width}×${height})`);
  }
  const assets = path.join(root, 'assets');
  await mkdir(assets, { recursive: true });
  const ico = buildIco(source);
  await writeFile(path.join(assets, 'icon.ico'), ico);
  await copyFile(sourceFile, path.join(assets, 'icon.png'));
  console.info(`assets/icon.ico: ${SIZES.join(', ')} px, ${ico.length} bytes (from ${path.relative(root, sourceFile)})`);
}

// No window is ever created: the icon is written and the process exits.
app.disableHardwareAcceleration();
try {
  await main();
  app.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  app.exit(1);
}
