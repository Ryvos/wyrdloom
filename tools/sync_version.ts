#!/usr/bin/env bun
// Sync package.json "version" -> src-tauri/tauri.conf.json + Cargo.toml.
// Single source of truth lives in package.json, mirrored at build time.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = new URL('..', import.meta.url).pathname;

const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
  version: string;
};
const version = pkg.version;
if (!/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/.test(version)) {
  console.error(`package.json version "${version}" is not a valid SemVer string`);
  process.exit(1);
}

// tauri.conf.json
const confPath = join(REPO_ROOT, 'src-tauri/tauri.conf.json');
const conf = JSON.parse(readFileSync(confPath, 'utf8'));
conf.version = version;
writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');

// Cargo.toml — line-by-line: replace the first `version = "..."` after `[package]`.
const cargoPath = join(REPO_ROOT, 'src-tauri/Cargo.toml');
const cargoLines = readFileSync(cargoPath, 'utf8').split('\n');
let inPackage = false;
let replaced = false;
for (let i = 0; i < cargoLines.length; i++) {
  const line = cargoLines[i] ?? '';
  if (line.trim().startsWith('[')) {
    inPackage = line.trim() === '[package]';
    continue;
  }
  if (inPackage && /^version\s*=\s*"[^"]*"/.test(line)) {
    cargoLines[i] = line.replace(/^version\s*=\s*"[^"]*"/, `version = "${version}"`);
    replaced = true;
    break;
  }
}
if (!replaced) {
  console.error('Cargo.toml: could not find [package] version line');
  process.exit(1);
}
writeFileSync(cargoPath, cargoLines.join('\n'));

console.log(`Synced version ${version} → tauri.conf.json + Cargo.toml`);
