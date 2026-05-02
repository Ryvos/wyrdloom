/// <reference path="../types/wyrdloom-global.d.ts" />
import { test, expect } from '@playwright/test';

const VERSION = '0.8.0';

async function enterCatacombs(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => window.__wyrdloom.dev.changeZone('catacombs'));
  await page.waitForFunction(() => window.__wyrdloom.zoneId === 'catacombs');
}

test.describe('procgen dungeon', () => {
  test('default seed (catacombs-1) is deterministic across reloads', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
    await enterCatacombs(page);
    const first = await page.evaluate(() => window.__wyrdloom.dungeon);

    await page.reload();
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
    await enterCatacombs(page);
    const second = await page.evaluate(() => window.__wyrdloom.dungeon);

    expect(second).toEqual(first);
  });

  test('player drops at the catacombs entrance on first descent', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
    await enterCatacombs(page);
    const ok = await page.evaluate(() => {
      const t = window.__wyrdloom.playerTile;
      const e = window.__wyrdloom.dungeon.entrance;
      return window.__wyrdloom.isFloor(t.tx, t.ty) && t.tx === e.tx && t.ty === e.ty;
    });
    expect(ok).toBe(true);
  });

  test('every entrance-to-boss A* path is reachable (validator works)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
    await enterCatacombs(page);
    const len = await page.evaluate(() => {
      const b = window.__wyrdloom.dungeon.boss;
      return window.__wyrdloom.dev.walkTo(b.tx, b.ty);
    });
    expect(len).toBeGreaterThan(0);
  });

  test('player can walk from entrance to boss room around walls', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
    await enterCatacombs(page);

    await page.evaluate(() => {
      const b = window.__wyrdloom.dungeon.boss;
      window.__wyrdloom.dev.walkTo(b.tx, b.ty);
    });
    await page.waitForFunction(
      () => {
        const t = window.__wyrdloom.playerTile;
        const b = window.__wyrdloom.dungeon.boss;
        return t.tx === b.tx && t.ty === b.ty;
      },
      undefined,
      { timeout: 12000 },
    );
    const t = await page.evaluate(() => window.__wyrdloom.playerTile);
    const b = await page.evaluate(() => window.__wyrdloom.dungeon.boss);
    expect(t).toEqual(b);
  });

  test('walking onto a wall tile is rejected (no goal set)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
    await enterCatacombs(page);
    // (0,0) is always a wall (border).
    const len = await page.evaluate(() => window.__wyrdloom.dev.walkTo(0, 0));
    expect(len).toBe(0);
    expect(await page.evaluate(() => window.__wyrdloom.goal)).toBeNull();
  });

  test('player teleport sets up an adjacent grunt fight without dungeon traversal', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
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
    const grunt = await page.evaluate(
      () => window.__wyrdloom.enemies.find((e) => e.id === 'grunt-1')!,
    );
    expect(grunt.hp).toBe(0);
  });
});
