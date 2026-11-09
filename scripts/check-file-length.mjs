#!/usr/bin/env node
// Enforces the spec rule (§8.3): every hand-written source file <= 500 lines.
// Usage: node scripts/check-file-length.mjs [--max=500]
// Exempt: generated EF migrations, node_modules, build output, type declarations.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const maxArg = process.argv.find((a) => a.startsWith('--max='));
const MAX_LINES = maxArg ? Number(maxArg.split('=')[1]) : 500;

const SCAN_ROOTS = [
  'respos-backend/src',
  'respos-backend/tests',
  'respos-admin/src',
  'respos-landing/src',
];
const EXTENSIONS = new Set(['.cs', '.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.sql']);
const EXCLUDED_DIRS = new Set(['Migrations', 'node_modules', 'dist', 'bin', 'obj', 'coverage']);

function isSourceFile(name) {
  if (name.endsWith('.d.ts')) return false;
  return EXTENSIONS.has(extname(name).toLowerCase());
}

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) yield* walk(full);
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      yield full;
    }
  }
}

function countLines(text) {
  if (text.length === 0) return 0;
  const lines = text.split(/\r\n|\r|\n/);
  return lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
}

async function main() {
  const offenders = [];
  let scanned = 0;
  for (const root of SCAN_ROOTS) {
    const absRoot = join(repoRoot, root);
    const exists = await stat(absRoot).then(() => true, () => false);
    if (!exists) {
      console.log(`skip: ${root} (not found)`);
      continue;
    }
    for await (const file of walk(absRoot)) {
      scanned += 1;
      const lines = countLines(await readFile(file, 'utf8'));
      if (lines > MAX_LINES) offenders.push({ file: relative(repoRoot, file), lines });
    }
  }

  if (offenders.length > 0) {
    offenders.sort((a, b) => b.lines - a.lines);
    console.error(`\n${offenders.length} file(s) exceed ${MAX_LINES} lines:`);
    for (const { file, lines } of offenders) console.error(`  ${lines.toString().padStart(5)}  ${file}`);
    console.error('\nSplit them by responsibility (see CONTRIBUTING.md, "Правило 500 строк").');
    process.exit(1);
  }
  console.log(`OK: ${scanned} source file(s) checked, none exceed ${MAX_LINES} lines.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
