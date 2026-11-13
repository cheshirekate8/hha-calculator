// scripts/import-catalog.ts — the catalog import (DESIGN.md §4.2).
//
//   node scripts/import-catalog.ts [--upstream <dir>] [--curated <dir>] [--out <file>]
//
// Reads the vendored upstream sheets and the hand-curated lists, checks every curated
// name against the catalog, and writes `src/data/catalog.json` in the §4.2.1 format.
// Defaults are `data/upstream`, `src/data/curated` and `src/data/catalog.json`; every
// path, including `data/SOURCE.md`, is resolved against the current directory.
//
// Node built-ins only — no packages, nothing fetched, and the same inputs always give
// byte-identical output.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  buildCatalog,
  commitFromSourceMd,
  compareStrings,
  findCuratedMisses,
  serializeCatalog,
} from './build-catalog.ts';
import type { UpstreamRow } from './build-catalog.ts';

const USAGE = 'usage: node scripts/import-catalog.ts [--upstream <dir>] [--curated <dir>] [--out <file>]';

const CURATED_FILES = ['lucky.json', 'seasonal.json', 'trash.json'];
const SOURCE_MD = path.join('data', 'SOURCE.md');

type Options = { upstream: string; curated: string; out: string };

function parseArgs(argv: string[], cwd: string): Options {
  const defaults: Options = {
    upstream: path.join('data', 'upstream'),
    curated: path.join('src', 'data', 'curated'),
    out: path.join('src', 'data', 'catalog.json'),
  };
  const given: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === undefined) continue;
    const key = flag.startsWith('--') ? flag.slice(2) : '';
    if (!Object.hasOwn(defaults, key)) {
      throw new Error(`unknown option ${JSON.stringify(flag)}\n${USAGE}`);
    }
    const value = argv[i + 1];
    if (value === undefined) throw new Error(`${flag} needs a value\n${USAGE}`);
    given[key] = value;
    i += 1;
  }
  const resolve = (key: keyof Options) => path.resolve(cwd, given[key] ?? defaults[key]);
  return { upstream: resolve('upstream'), curated: resolve('curated'), out: resolve('out') };
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Every sheet in the upstream directory, read in sorted filename order so the result
 * never depends on the filesystem's directory order.
 */
function readUpstream(dir: string): UpstreamRow[] {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort(compareStrings);
  if (files.length === 0) throw new Error(`${dir}: no .json sheets found`);
  const rows: UpstreamRow[] = [];
  for (const file of files) {
    const sheet = readJson(path.join(dir, file));
    if (!Array.isArray(sheet)) throw new Error(`${file}: expected an array of rows`);
    for (const [i, row] of sheet.entries()) {
      if (typeof row !== 'object' || row === null) throw new Error(`${file}[${i}]: expected an object`);
      rows.push(row as UpstreamRow);
    }
  }
  return rows;
}

function readCurated(dir: string): Map<string, unknown> {
  const curated = new Map<string, unknown>();
  for (const file of CURATED_FILES) curated.set(file, readJson(path.join(dir, file)));
  return curated;
}

function main(argv: string[]): number {
  const options = parseArgs(argv, process.cwd());
  const sourceMd = path.resolve(process.cwd(), SOURCE_MD);
  const commit = commitFromSourceMd(fs.readFileSync(sourceMd, 'utf8'), SOURCE_MD);

  const catalog = buildCatalog(readUpstream(options.upstream), commit);

  // Curated names are checked before anything is written, so a bad list leaves no
  // half-right catalog behind (DESIGN.md §4.3).
  const misses = findCuratedMisses(readCurated(options.curated), catalog.items);
  if (misses.length > 0) {
    for (const miss of misses) {
      process.stderr.write(`${miss.file} ${miss.key}: no catalog item named ${JSON.stringify(miss.name)}\n`);
    }
    process.stderr.write(`${misses.length} curated name(s) match no catalog item; wrote nothing\n`);
    return 1;
  }

  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, serializeCatalog(catalog));
  process.stderr.write(
    `${path.relative(process.cwd(), options.out) || options.out}: ${catalog.items.length} items, `
    + `${Object.keys(catalog.sets).length} sets, commit ${commit}\n`,
  );
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
