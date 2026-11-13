#!/usr/bin/env node
// Planning-time tool (DESIGN.md §4.2): copies the pinned upstream item sheets into
// data/upstream/, with translation and image fields removed, and records the pin in
// data/SOURCE.md. Run on the host, in a planning session, never in a task: pipeline
// containers have no network.
//
//   node tools/vendor-upstream.mjs <commit-sha>
//
// Nothing is changed in a copied sheet except the dropped fields, with one exception:
// the Other sheet is reduced to the trash rows, because the rest of it (materials,
// "lost item" ×3 and similar) is not placeable and carries duplicate names.
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'Norviah/animal-crossing';
const SHEETS = [
  'Housewares', 'Miscellaneous', 'Wall-mounted', 'Ceiling Decor',
  'Wallpaper', 'Floors', 'Rugs',
  'Photos', 'Posters', 'Gyroids', 'Fossils', 'Artwork',
  'Fish', 'Insects', 'Sea Creatures',
  'Other',
];
const OTHER_KEEP = new Set(['boot', 'empty can', 'old tire', 'spoiled turnips']);
const DROP = /(translations|image|filename)$/i;

const strip = (v) =>
  Array.isArray(v) ? v.map(strip)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([k]) => !DROP.test(k)).map(([k, x]) => [k, strip(x)]))
    : v;

const sha = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(sha ?? '')) {
  console.error('usage: node tools/vendor-upstream.mjs <40-char commit sha>');
  process.exit(2);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const out = path.join(root, 'data', 'upstream');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const rows = [];
for (const sheet of SHEETS) {
  const url = `https://raw.githubusercontent.com/${REPO}/${sha}/json/data/${encodeURIComponent(sheet)}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${sheet}: HTTP ${res.status} from ${url}`);
  let data = strip(await res.json());
  if (sheet === 'Other') data = data.filter((r) => OTHER_KEEP.has(r.name));
  fs.writeFileSync(path.join(out, `${sheet}.json`), JSON.stringify(data) + '\n');
  rows.push(`| ${sheet} | ${data.length} |`);
  console.log(`${sheet}: ${data.length} rows`);
}

fs.writeFileSync(path.join(root, 'data', 'SOURCE.md'), `# Upstream item data

- **Source:** [${REPO}](https://github.com/${REPO}), MIT licensed, a JSON conversion of the
  community ACNH data spreadsheet. Credit to both.
- **Pinned commit:** \`${sha}\`
- **Copied by:** \`node tools/vendor-upstream.mjs ${sha}\` (DESIGN.md §4.2), at planning time.
- **Changes from upstream:** fields whose names end in \`translations\`, \`image\` or
  \`filename\` are removed, and the Other sheet keeps only its trash rows
  (${[...OTHER_KEEP].join(', ')}). Nothing else is changed.

Never edit these files by hand. Refreshing them is a planning-session step.

| Sheet | Rows |
|---|---|
${rows.join('\n')}
`);
console.log('wrote data/upstream and data/SOURCE.md');
