/// <reference path="../types/wyrdloom-global.d.ts" />
import { test, expect } from '@playwright/test';

const TARGET_VERSION = '0.5.0';

// Default seed produces a deterministic dungeon — entrance (8,4), boss (28,26)
// in a 32×32 grid. Tests that need a specific layout should pin to this seed.
const ENTRANCE = { tx: 8, ty: 4 };
const BOSS = { tx: 28, ty: 26 };

test.describe('boot + procgen', () => {
  test('boots without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });

  test('player spawns in the entrance room with full hp', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    const state = await page.evaluate(() => ({
      tile: window.__wyrdloom.playerTile,
      hp: window.__wyrdloom.playerHp,
      alive: window.__wyrdloom.playerAlive,
      entrance: window.__wyrdloom.dungeon.entrance,
    }));
    expect(state.tile).toEqual(ENTRANCE);
    expect(state.entrance).toEqual(ENTRANCE);
    expect(state.hp).toBe(100);
    expect(state.alive).toBe(true);
  });

  test('enemy spawns in the boss room with full hp', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    const enemies = await page.evaluate(() => window.__wyrdloom.enemies);
    expect(enemies).toEqual([
      { id: 'enemy-0', tile: BOSS, hp: 50, alive: true },
    ]);
  });

  test('default seed produces 9 rooms in a 32x32 grid', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    const d = await page.evaluate(() => window.__wyrdloom.dungeon);
    expect(d).toMatchObject({
      seed: 'catacombs-1',
      w: 32,
      h: 32,
      roomCount: 9,
    });
  });

  test('walls reject clicks; floor clicks set a goal', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    // (0,0) is always a wall (border). walkTo() should return 0.
    const wallLen = await page.evaluate(() => window.__wyrdloom.dev.walkTo(0, 0));
    expect(wallLen).toBe(0);
    expect(await page.evaluate(() => window.__wyrdloom.goal)).toBeNull();

    // The boss room center is reachable; A* should return a long path.
    const floorLen = await page.evaluate(
      (b) => window.__wyrdloom.dev.walkTo(b.tx, b.ty),
      BOSS,
    );
    expect(floorLen).toBeGreaterThan(20);
    expect(await page.evaluate(() => window.__wyrdloom.goal)).toEqual(BOSS);
  });

  test('player walks the A* path to a distant goal', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    // Walk to a known floor tile a couple of rooms over.
    await page.evaluate((b) => window.__wyrdloom.dev.walkTo(b.tx, b.ty), BOSS);
    await page.waitForFunction(
      (b) => {
        const t = window.__wyrdloom.playerTile;
        return t.tx === b.tx && t.ty === b.ty;
      },
      BOSS,
      { timeout: 10000 },
    );
    const finalTile = await page.evaluate(() => window.__wyrdloom.playerTile);
    expect(finalTile).toEqual(BOSS);
  });
});

test.describe('combat (v0.5.0 — uses teleport for setup)', () => {
  test('attacking the enemy via dev.attackEnemy kills it', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    // Put the player + enemy adjacent in the entrance room so combat plays out
    // without dungeon traversal (and without enemy AI hits during the walk).
    await page.evaluate(() => {
      window.__wyrdloom.dev.teleportPlayer(8, 4);
      window.__wyrdloom.dev.teleportEnemy('enemy-0', 9, 4);
      window.__wyrdloom.dev.attackEnemy('enemy-0');
    });

    await page.waitForFunction(
      () => window.__wyrdloom.enemies[0]?.alive === false,
      undefined,
      { timeout: 5000 },
    );
    const enemy = await page.evaluate(() => window.__wyrdloom.enemies[0]);
    expect(enemy!.alive).toBe(false);
    expect(enemy!.hp).toBe(0);
  });

  test('enemy respawns within 4s of dying (on a random floor tile)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    // Trigger a kill via teleport + auto-attack.
    await page.evaluate(() => {
      window.__wyrdloom.dev.teleportPlayer(8, 4);
      window.__wyrdloom.dev.teleportEnemy('enemy-0', 9, 4);
      window.__wyrdloom.dev.attackEnemy('enemy-0');
    });
    await page.waitForFunction(
      () => window.__wyrdloom.enemies[0]?.alive === false,
      undefined,
      { timeout: 5000 },
    );

    await page.waitForFunction(
      () => window.__wyrdloom.enemies[0]?.alive === true,
      undefined,
      { timeout: 4500 },
    );
    const enemy = await page.evaluate(() => window.__wyrdloom.enemies[0]);
    expect(enemy!.alive).toBe(true);
    expect(enemy!.hp).toBe(50);
  });

  test('player death respawns at entrance room with full hp', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    await page.evaluate(() => window.__wyrdloom.dev.setPlayerHp(0));
    expect(await page.evaluate(() => window.__wyrdloom.playerAlive)).toBe(false);

    await page.waitForFunction(
      () => window.__wyrdloom.playerAlive === true,
      undefined,
      { timeout: 3000 },
    );

    const state = await page.evaluate(() => ({
      tile: window.__wyrdloom.playerTile,
      hp: window.__wyrdloom.playerHp,
      alive: window.__wyrdloom.playerAlive,
    }));
    expect(state).toEqual({ tile: ENTRANCE, hp: 100, alive: true });
  });

  test('hp readout reflects damage taken', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    await page.evaluate(() => window.__wyrdloom.dev.setPlayerHp(73));
    const text = await page.locator('[data-testid="hp-readout"]').textContent();
    expect(text).toBe('HP 73 / 100');
  });
});
