/// <reference path="../types/wyrdloom-global.d.ts" />
import { test, expect } from '@playwright/test';

const TARGET_VERSION = '0.3.0';

test.describe('boot + movement', () => {
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

  test('player spawns at (6,6) with full hp', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    const state = await page.evaluate(() => ({
      tile: window.__wyrdloom.playerTile,
      hp: window.__wyrdloom.playerHp,
      alive: window.__wyrdloom.playerAlive,
    }));
    expect(state).toEqual({ tile: { tx: 6, ty: 6 }, hp: 100, alive: true });
  });

  test('enemy spawns at (9,3) with full hp', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);
    const enemies = await page.evaluate(() => window.__wyrdloom.enemies);
    expect(enemies).toEqual([
      { id: 'enemy-0', tile: { tx: 9, ty: 3 }, hp: 50, alive: true },
    ]);
  });

  test('left-click on empty tile sets goal and walks player', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    // Click southwest — viewport (480, 400) maps to tile (4, 9) when camera is
    // centered on player (6,6) in a 1280x800 viewport; both axes are inside the
    // 12x12 grid so the click handler accepts the goal.
    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 480, clientY: 400, button: 0,
          pointerType: 'mouse', pointerId: 1, bubbles: true, cancelable: true,
        }),
      );
    });

    const goal = await page.evaluate(() => window.__wyrdloom.goal);
    expect(goal).not.toBeNull();
    expect(goal).not.toEqual({ tx: 6, ty: 6 });

    // Wait for player to reach goal (or to come close).
    await page.waitForFunction(
      () => window.__wyrdloom.goal === null,
      undefined,
      { timeout: 4000 },
    );
  });

  test('out-of-bounds clicks are ignored', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 10, clientY: 10, button: 0,
          pointerType: 'mouse', pointerId: 1, bubbles: true, cancelable: true,
        }),
      );
    });
    await page.waitForTimeout(150);
    const { goal, target } = await page.evaluate(() => ({
      goal: window.__wyrdloom.goal,
      target: window.__wyrdloom.attackTarget,
    }));
    expect(goal).toBeNull();
    expect(target).toBeNull();
  });
});

test.describe('combat', () => {
  test('clicking enemy sets attackTarget and player kills it', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    // Enemy at (9,3) maps to viewport (832, 400) when player is at (6,6) and the
    // viewport is 1280x800 (camera centers on the player).
    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 832, clientY: 400, button: 0,
          pointerType: 'mouse', pointerId: 1, bubbles: true, cancelable: true,
        }),
      );
    });
    expect(await page.evaluate(() => window.__wyrdloom.attackTarget)).toBe('enemy-0');

    // The player walks to melee range and kills (50 hp / 25 atk = 2 hits).
    // Worst case: 6 walk steps (~900 ms) + 2 attacks (~800 ms) = ~1.7 s.
    await page.waitForFunction(
      () => window.__wyrdloom.enemies[0]?.alive === false,
      undefined,
      { timeout: 5000 },
    );

    const enemy = await page.evaluate(() => window.__wyrdloom.enemies[0]);
    expect(enemy!.alive).toBe(false);
    expect(enemy!.hp).toBe(0);
  });

  test('enemy respawns within 4s of dying', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    // Trigger a kill.
    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 832, clientY: 400, button: 0,
          pointerType: 'mouse', pointerId: 1, bubbles: true, cancelable: true,
        }),
      );
    });
    await page.waitForFunction(
      () => window.__wyrdloom.enemies[0]?.alive === false,
      undefined,
      { timeout: 5000 },
    );

    // Enemy respawns 3 s after death — wait up to 4.5 s and re-check.
    await page.waitForFunction(
      () => window.__wyrdloom.enemies[0]?.alive === true,
      undefined,
      { timeout: 4500 },
    );
    const enemy = await page.evaluate(() => window.__wyrdloom.enemies[0]);
    expect(enemy!.alive).toBe(true);
    expect(enemy!.hp).toBe(50);
  });

  test('player death triggers respawn at (6,6) with full hp', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    // Force player death via the dev hook.
    await page.evaluate(() => window.__wyrdloom.dev.setPlayerHp(0));
    expect(await page.evaluate(() => window.__wyrdloom.playerAlive)).toBe(false);

    // 2 s respawn timer.
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
    expect(state).toEqual({ tile: { tx: 6, ty: 6 }, hp: 100, alive: true });
  });

  test('hp readout reflects damage taken', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, TARGET_VERSION);

    await page.evaluate(() => window.__wyrdloom.dev.setPlayerHp(73));
    const text = await page.locator('[data-testid="hp-readout"]').textContent();
    expect(text).toBe('HP 73 / 100');
  });
});
