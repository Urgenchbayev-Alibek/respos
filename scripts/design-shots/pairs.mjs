// Builds docs/design/assets/redesign/pairs.json: one entry per capture present in both the
// "before" and "after" sets (matched by id + theme), with repo-relative file paths.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const base = 'docs/design/assets/redesign';

function load(label) {
  const manifest = JSON.parse(readFileSync(join(repoRoot, base, label, 'manifest.json'), 'utf8'));
  return new Map(manifest.items.map((item) => [`${item.id}|${item.theme ?? ''}`, item]));
}

const before = load('before');
const after = load('after');
const pairs = [];
for (const [key, item] of before) {
  const match = after.get(key);
  if (!match) continue;
  const beforePath = `${base}/before/${item.file}`;
  const afterPath = `${base}/after/${match.file}`;
  if (!existsSync(join(repoRoot, beforePath)) || !existsSync(join(repoRoot, afterPath))) continue;
  pairs.push({
    id: item.id,
    title: item.title,
    group: item.group,
    kind: item.kind === 'screenshot' ? 'image' : 'clip',
    viewport: match.viewport,
    theme: item.theme ?? null,
    before: beforePath,
    after: afterPath,
  });
}

writeFileSync(join(repoRoot, base, 'pairs.json'), `${JSON.stringify(pairs, null, 2)}\n`);
const images = pairs.filter((pair) => pair.kind === 'image').length;
console.log(`pairs.json: ${images} image pairs, ${pairs.length - images} clip pairs`);
