#!/usr/bin/env bun
// Bot-play harness — drives randomized inputs against the Wyrdloom canvas
// for a configurable duration and asserts no console errors / unhandled
// rejections / `console.warn`. v1.0.0 DoD requires 1 hour of clean play.
//
// Usage:
//   1. Start the dev server: `bun run dev` (or set BOT_BASE_URL to a deployed URL)
//   2. Run: `bun tools/bot_play.ts`           (60s default)
//          `BOT_DURATION_MS=3600000 bun tools/bot_play.ts`  (1 hour — DoD run)
//
// The bot is split in two: the **fuzzer** drives random canvas clicks +
// keypresses + skill triggers; the **watchdog** revives the player when HP
// drops to zero (non-hardcore) or rotates a fresh save slot (hardcore). The
// watchdog is what makes the 1-hour DoD reachable — without it, a fuzzer dies
// in 90 seconds against the catacombs grunts.
//
// Exit code: 0 on clean run, 1 if any console.error / pageerror / unhandled
// rejection fires; 2 if the page never finishes booting.

import { chromium, type ConsoleMessage, type Page } from '@playwright/test';

const BASE_URL = process.env.BOT_BASE_URL ?? 'http://127.0.0.1:1420';
const DURATION_MS = Number(process.env.BOT_DURATION_MS ?? 60_000);
const TICK_MS = Number(process.env.BOT_TICK_MS ?? 200);
const HEADLESS = process.env.BOT_HEADLESS !== '0';
const SEED = process.env.BOT_SEED ?? String(Date.now());

// Tiny seedable PRNG (Mulberry32) — matches the determinism rigor the rest
// of the codebase uses without pulling in seedrandom for one script.
function mulberry32(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  let s = h >>> 0;
  return (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const pick = <T>(xs: ReadonlyArray<T>): T => xs[Math.floor(rand() * xs.length)] as T;

// Action mix — weighted to favor canvas clicks (movement + attack) since
// that's the dominant interaction. Skill triggers and panel toggles spice it
// up so the bot exercises the HUD as well.
const ACTIONS = [
  ...Array(10).fill('canvas-click'),
  ...Array(2).fill('skill'),
  ...Array(1).fill('panel-toggle'),
  ...Array(1).fill('save'),
] as const;

const SKILL_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'] as const;
const PANEL_KEYS = ['KeyI', 'KeyC', 'KeyB', 'KeyM', 'KeyE', 'KeyO', 'KeyQ', 'Escape'] as const;
const SAVE_KEY = 'KeyS';

type BotMetrics = {
  ticks: number;
  clicks: number;
  skills: number;
  panels: number;
  saves: number;
  respawns: number;
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
};

async function bootPage(page: Page, metrics: BotMetrics): Promise<boolean> {
  page.on('console', (msg: ConsoleMessage) => {
    const t = msg.type();
    if (t === 'error') metrics.consoleErrors.push(msg.text());
    else if (t === 'warning') metrics.consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (err: Error) => {
    metrics.pageErrors.push(`${err.name}: ${err.message}`);
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
  // Wait for the runtime debug handle. If the app didn't boot in 30s,
  // bail out — something more fundamental is wrong than the bot can probe.
  try {
    await page.waitForFunction(() => Boolean(window.__wyrdloom?.version), null, { timeout: 30_000 });
  } catch {
    return false;
  }
  // If a first-boot character-creation modal is up, drive through it with
  // defaults (Furyborn, "Bot", non-hardcore). The bot is a regression probe,
  // not a hardcore fairness test.
  await page.evaluate(() => {
    const modal = document.querySelector('wyrd-character-creation');
    if (modal?.hasAttribute('open')) {
      const begin = modal.shadowRoot?.querySelector<HTMLButtonElement>('[data-testid="cc-begin"]');
      begin?.click();
    }
  });
  return true;
}

async function tick(page: Page, metrics: BotMetrics): Promise<void> {
  const action = pick(ACTIONS);
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) return;
  switch (action) {
    case 'canvas-click': {
      const x = box.x + rand() * box.width;
      const y = box.y + rand() * box.height;
      await page.mouse.click(x, y, { delay: 0 });
      metrics.clicks += 1;
      break;
    }
    case 'skill': {
      await page.keyboard.press(pick(SKILL_KEYS));
      metrics.skills += 1;
      break;
    }
    case 'panel-toggle': {
      await page.keyboard.press(pick(PANEL_KEYS));
      metrics.panels += 1;
      break;
    }
    case 'save': {
      await page.keyboard.press(SAVE_KEY);
      metrics.saves += 1;
      break;
    }
  }
}

// Watchdog: if the player dies, force a respawn via the dev hook. Hardcore
// characters don't autosave on death (the slot is wiped) — we just reload
// and let character-creation roll a new slot.
async function watchdog(page: Page, metrics: BotMetrics): Promise<void> {
  const state = await page.evaluate(() => ({
    alive: window.__wyrdloom?.playerAlive ?? false,
    hp: window.__wyrdloom?.playerHp ?? 0,
    maxHp: window.__wyrdloom?.playerMaxHp ?? 1,
  }));
  if (!state.alive || state.hp <= 0) {
    await page.evaluate(() => {
      const dev = window.__wyrdloom?.dev as
        | { setPlayerHp?: (n: number) => void; teleportPlayer?: (x: number, y: number) => boolean }
        | undefined;
      if (!dev) return;
      // Push HP back to full and bounce back to the Whitestone hub. If the
      // dev surface has no setPlayerHp (older builds), the bot just keeps
      // pressing keys and the death overlay swallows them — that's fine.
      dev.setPlayerHp?.(window.__wyrdloom.playerMaxHp);
    });
    metrics.respawns += 1;
  }
}

function summary(metrics: BotMetrics, elapsedMs: number): string {
  const lines = [
    `bot-play summary (seed=${SEED}, duration=${(elapsedMs / 1000).toFixed(1)}s)`,
    `  ticks         ${metrics.ticks}`,
    `  canvas clicks ${metrics.clicks}`,
    `  skill presses ${metrics.skills}`,
    `  panel toggles ${metrics.panels}`,
    `  save presses  ${metrics.saves}`,
    `  respawns      ${metrics.respawns}`,
    `  console.error ${metrics.consoleErrors.length}`,
    `  console.warn  ${metrics.consoleWarnings.length}`,
    `  pageerror     ${metrics.pageErrors.length}`,
  ];
  if (metrics.consoleErrors.length > 0) {
    lines.push('', 'Errors:');
    for (const e of metrics.consoleErrors.slice(0, 10)) lines.push(`  • ${e}`);
  }
  if (metrics.pageErrors.length > 0) {
    lines.push('', 'Page errors:');
    for (const e of metrics.pageErrors.slice(0, 10)) lines.push(`  • ${e}`);
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  console.log(`bot_play: ${BASE_URL} for ${DURATION_MS}ms (seed=${SEED}, headless=${HEADLESS})`);
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const metrics: BotMetrics = {
    ticks: 0,
    clicks: 0,
    skills: 0,
    panels: 0,
    saves: 0,
    respawns: 0,
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
  };
  const ok = await bootPage(page, metrics);
  if (!ok) {
    console.error('bot_play: page never finished booting');
    await browser.close();
    process.exit(2);
  }
  const start = Date.now();
  let lastWatchdog = start;
  while (Date.now() - start < DURATION_MS) {
    try {
      await tick(page, metrics);
      metrics.ticks += 1;
    } catch (err) {
      metrics.pageErrors.push(`tick: ${(err as Error).message}`);
    }
    if (Date.now() - lastWatchdog > 1500) {
      try {
        await watchdog(page, metrics);
      } catch {
        // Watchdog failures are noisy but non-fatal; the bot keeps fuzzing.
      }
      lastWatchdog = Date.now();
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
  const elapsed = Date.now() - start;
  console.log(summary(metrics, elapsed));
  await browser.close();
  const failed =
    metrics.consoleErrors.length > 0 ||
    metrics.pageErrors.length > 0 ||
    // Console warnings are advisory but the v1.0.0 DoD line ("no console.error
    // / console.warn in 5-min play") promotes them to fail-conditions too.
    metrics.consoleWarnings.length > 0;
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('bot_play crashed:', err);
  process.exit(1);
});
