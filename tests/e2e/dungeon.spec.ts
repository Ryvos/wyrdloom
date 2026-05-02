/// <reference path="../types/wyrdloom-global.d.ts" />
import { test, expect } from '@playwright/test';

const VERSION = '0.5.0';

test.describe('procgen dungeon (v0.5.0)', () => {
  test('default seed (catacombs-1) is deterministic across reloads', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
    const first = await page.evaluate(() => window.__wyrdloom.dungeon);

    await page.reload();
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
    const second = await page.evaluate(() => window.__wyrdloom.dungeon);

    expect(second).toEqual(first);
  });

  test('player spawn is on a floor tile in the entrance room', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
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
    const len = await page.evaluate(() => {
      const b = window.__wyrdloom.dungeon.boss;
      return window.__wyrdloom.dev.walkTo(b.tx, b.ty);
    });
    expect(len).toBeGreaterThan(0);
  });

  test('player can walk from entrance to boss room around walls', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

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
    // (0,0) is always a wall (border).
    const len = await page.evaluate(() => window.__wyrdloom.dev.walkTo(0, 0));
    expect(len).toBe(0);
    expect(await page.evaluate(() => window.__wyrdloom.goal)).toBeNull();
  });

  test('player teleport sets up an adjacent enemy fight without dungeon traversal', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

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
    expect(await page.evaluate(() => window.__wyrdloom.enemies[0]?.hp)).toBe(0);
  });
});
