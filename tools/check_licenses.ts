#!/usr/bin/env bun
// CI license-compliance gate.
// Walks assets/** and ensures every leaf folder name appears in LICENSES.md.
// Also verifies tauri.conf.json doesn't smuggle in forbidden capabilities.
//
// Exit non-zero if any asset folder has no attribution row,
// or if a forbidden Tauri capability snuck into the allow-list.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = new URL('..', import.meta.url).pathname;
const ASSET_ROOT = join(REPO_ROOT, 'assets');
const LICENSES_PATH = join(REPO_ROOT, 'LICENSES.md');
const TAURI_CONF = join(REPO_ROOT, 'src-tauri/tauri.conf.json');
const TAURI_CAPS = join(REPO_ROOT, 'src-tauri/capabilities/default.json');

const FORBIDDEN_PERMISSIONS = ['http:', 'shell:', 'process:'];

function leafDirs(root: string): string[] {
  const out: string[] = [];
  try {
    walk(root, out);
  } catch {
    // assets/ may not exist yet on a fresh checkout; that's fine.
  }
  return out;
}

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  const subdirs = entries.filter((e) => {
    try {
      return statSync(join(dir, e)).isDirectory();
    } catch {
      return false;
    }
  });
  if (subdirs.length === 0) {
    // Leaf — but only count it if it has at least one file.
    const hasFile = entries.some((e) => {
      try {
        return statSync(join(dir, e)).isFile();
      } catch {
        return false;
      }
    });
    if (hasFile) out.push(dir);
    return;
  }
  for (const s of subdirs) walk(join(dir, s), out);
}

function checkAssets(): string[] {
  const errors: string[] = [];
  const licenses = (() => {
    try {
      return readFileSync(LICENSES_PATH, 'utf8');
    } catch {
      return '';
    }
  })();

  if (!licenses) {
    errors.push('LICENSES.md missing or empty.');
    return errors;
  }

  const leaves = leafDirs(ASSET_ROOT);
  for (const leaf of leaves) {
    const slug = leaf.split('/').pop() ?? '';
    if (!slug) continue;
    if (!licenses.includes(slug)) {
      errors.push(
        `Asset folder ${relative(REPO_ROOT, leaf)} has no row in LICENSES.md (slug "${slug}" not found).`,
      );
    }
  }
  return errors;
}

function checkTauri(): string[] {
  const errors: string[] = [];
  // Tauri permission identifiers look like `namespace:permission-name` —
  // lowercase-ascii namespace + colon + lowercase-ascii kebab name. URLs (http://…)
  // and CSP strings (http:…/…) don't match because they contain `/` or `.`.
  const PERM_ID = /^([a-z][a-z0-9-]*):[a-z][a-z0-9-]+$/;
  for (const path of [TAURI_CONF, TAURI_CAPS]) {
    let raw = '';
    try {
      raw = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    const lines = raw.split('\n');
    for (const ln of lines) {
      if (ln.trim().startsWith('//')) continue;
      const inQuotes = ln.match(/"([^"]+)"/g);
      if (!inQuotes) continue;
      for (const q of inQuotes) {
        const inner = q.slice(1, -1);
        const match = inner.match(PERM_ID);
        if (!match) continue;
        const ns = match[1];
        if (FORBIDDEN_PERMISSIONS.includes(ns + ':')) {
          errors.push(
            `${relative(REPO_ROOT, path)} grants forbidden capability "${inner}" — see BUILD_PROMPT §2.5`,
          );
        }
      }
    }
  }
  return errors;
}

const errors = [...checkAssets(), ...checkTauri()];
if (errors.length > 0) {
  console.error('\n  License/capability gate FAILED:\n');
  for (const e of errors) console.error('  - ' + e);
  console.error('');
  process.exit(1);
}
console.log('License/capability gate OK.');
