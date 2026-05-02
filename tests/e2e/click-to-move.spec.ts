/// <reference path="../types/wyrdloom-global.d.ts" />
import { test, expect } from '@playwright/test';

const TARGET_VERSION = '0.8.0';

// v0.6.0+: player boots in the Whitestone hub. Catacombs is reached by
// stepping onto the south doorway, or via dev.changeZone() in tests.
// v0.7.0+: default class is Furyborn — baseHp 120, baseAtk 28.
const HUB_SPAWN = { tx: 8, ty: 8 };
const CATACOMBS_ENTRANCE = { tx: 8, ty: 4 };
const CATACOMBS_BOSS = { tx: 28, ty: 26 };

// Helper: jump straight to catacombs for tests that need procgen state.
async function enterCatacombs(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => window.__wyrdloom.dev.changeZone('catacombs'));
  await page.waitForFunction(() => window.__wyrdloom.zoneId === 'catacombs');
}

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

  test('player boots into Whitestone hub at full hp', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    const state = await page.evaluate(() => ({
      tile: window.__wyrdloom.playerTile,
      hp: window.__wyrdloom.playerHp,
      alive: window.__wyrdloom.playerAlive,
      zoneId: window.__wyrdloom.zoneId,
    }));
    expect(state.zoneId).toBe('whitestone');
    expect(state.tile).toEqual(HUB_SPAWN);
    expect(state.hp).toBe(120); // Furyborn baseline
    expect(state.alive).toBe(true);
  });

  test('catacombs entry spawns 1 grunt + Hollow Bishop', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    await enterCatacombs(page);
    const enemies = await page.evaluate(() => window.__wyrdloom.enemies);
    const ids = enemies.map((e) => e.id).sort();
    expect(ids).toEqual(['grunt-1', 'hollow-bishop']);
    const bishop = enemies.find((e) => e.id === 'hollow-bishop');
    expect(bishop).toMatchObject({ tile: CATACOMBS_BOSS, hp: 200, alive: true });
  });

  test('default catacombs seed produces 9 rooms in a 32x32 grid', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    await enterCatacombs(page);
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
    await enterCatacombs(page);

    // (0,0) is always a wall (border). walkTo() should return 0.
    const wallLen = await page.evaluate(() => window.__wyrdloom.dev.walkTo(0, 0));
    expect(wallLen).toBe(0);
    expect(await page.evaluate(() => window.__wyrdloom.goal)).toBeNull();

    // The boss room center is reachable; A* should return a long path.
    const floorLen = await page.evaluate(
      (b) => window.__wyrdloom.dev.walkTo(b.tx, b.ty),
      CATACOMBS_BOSS,
    );
    expect(floorLen).toBeGreaterThan(20);
    expect(await page.evaluate(() => window.__wyrdloom.goal)).toEqual(CATACOMBS_BOSS);
  });

  test('player walks the A* path to a distant goal', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    await enterCatacombs(page);

    await page.evaluate((b) => window.__wyrdloom.dev.walkTo(b.tx, b.ty), CATACOMBS_BOSS);
    await page.waitForFunction(
      (b) => {
        const t = window.__wyrdloom.playerTile;
        return t.tx === b.tx && t.ty === b.ty;
      },
      CATACOMBS_BOSS,
      { timeout: 10000 },
    );
    const finalTile = await page.evaluate(() => window.__wyrdloom.playerTile);
    expect(finalTile).toEqual(CATACOMBS_BOSS);
  });
});

test.describe('combat (uses teleport for setup)', () => {
  test('attacking the grunt via dev.attackEnemy kills it', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    await enterCatacombs(page);

    // Put the player + grunt adjacent in the entrance room so combat plays out
    // without dungeon traversal (and without enemy AI hits during the walk).
    await page.evaluate(() => {
      window.__wyrdloom.dev.teleportPlayer(8, 4);
      window.__wyrdloom.dev.teleportEnemy('grunt-1', 9, 4);
      window.__wyrdloom.dev.attackEnemy('grunt-1');
    });

    await page.waitForFunction(
      () => {
        const g = window.__wyrdloom.enemies.find((e) => e.id === 'grunt-1');
        return g?.alive === false;
      },
      undefined,
      { timeout: 5000 },
    );
    const grunt = await page.evaluate(
      () => window.__wyrdloom.enemies.find((e) => e.id === 'grunt-1')!,
    );
    expect(grunt.alive).toBe(false);
    expect(grunt.hp).toBe(0);
  });

  test('grunt respawns within 4s of dying (on a random floor tile)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    await enterCatacombs(page);

    await page.evaluate(() => {
      window.__wyrdloom.dev.teleportPlayer(8, 4);
      window.__wyrdloom.dev.teleportEnemy('grunt-1', 9, 4);
      window.__wyrdloom.dev.attackEnemy('grunt-1');
    });
    await page.waitForFunction(
      () => {
        const g = window.__wyrdloom.enemies.find((e) => e.id === 'grunt-1');
        return g?.alive === false;
      },
      undefined,
      { timeout: 5000 },
    );

    await page.waitForFunction(
      () => {
        const g = window.__wyrdloom.enemies.find((e) => e.id === 'grunt-1');
        return g?.alive === true;
      },
      undefined,
      { timeout: 4500 },
    );
    const grunt = await page.evaluate(
      () => window.__wyrdloom.enemies.find((e) => e.id === 'grunt-1')!,
    );
    expect(grunt.alive).toBe(true);
    expect(grunt.hp).toBe(50);
  });

  test('player death respawns at the catacombs entrance with full hp', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    await enterCatacombs(page);

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
    expect(state).toEqual({ tile: CATACOMBS_ENTRANCE, hp: 120, alive: true });
  });

  test('hp readout reflects damage taken', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    await page.evaluate(() => window.__wyrdloom.dev.setPlayerHp(73));
    const text = await page.locator('[data-testid="hp-readout"]').textContent();
    expect(text).toBe('HP 73 / 120');
  });
});
