/// <reference path="../types/wyrdloom-global.d.ts" />
import { test, expect } from '@playwright/test';

const VERSION = '0.3.0';
// Seed handpicked from offline probe — yields a magic Honed Iron Sword of Malice
// (weapon, baseDamage 10, +Honed atk_flat, +of-Malice atk_flat).
const WEAPON_SEED = 'weapon-seed-17';

test.describe('loot pipeline', () => {
  test('forceDrop deterministically yields the same item for a given seed', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    await page.evaluate((s) => window.__wyrdloom.dev.forceDrop(s), WEAPON_SEED);
    const ground = await page.evaluate(() => window.__wyrdloom.groundItems);
    expect(ground).toHaveLength(1);
    expect(ground[0]).toMatchObject({
      name: 'Honed Iron Sword of Malice',
      rarity: 'magic',
      slot: 'weapon',
      affixCount: 2,
    });
  });

  test('hovering a ground item shows the tooltip with affixes', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    await page.evaluate((s) => window.__wyrdloom.dev.forceDrop(s), WEAPON_SEED);

    // Pointermove over the item tile (9,3) — viewport (832, 400) at default camera.
    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 832, clientY: 400,
          pointerType: 'mouse', pointerId: 1, bubbles: true, cancelable: true,
        }),
      );
    });

    const tip = page.locator('#item-tooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Honed Iron Sword of Malice');
    await expect(tip).toContainText('Damage: 10');
    await expect(tip).toContainText('Honed');
    await expect(tip).toContainText('of Malice');
  });

  test('walking onto a ground item then clicking it equips and increases atk', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    const initialAtk = await page.evaluate(() => window.__wyrdloom.playerAtk);
    expect(initialAtk).toBe(25);

    await page.evaluate((s) => window.__wyrdloom.dev.forceDrop(s), WEAPON_SEED);

    // First click: walk to (9,3). From (6,6), that's viewport (832, 400).
    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 832, clientY: 400, button: 0,
          pointerType: 'mouse', pointerId: 1, bubbles: true, cancelable: true,
        }),
      );
    });
    await page.waitForFunction(
      () => window.__wyrdloom.playerTile.tx === 9 && window.__wyrdloom.playerTile.ty === 3,
      undefined,
      { timeout: 3000 },
    );

    // Second click: pick up. Camera now centered on (9,3), so viewport (640,400)
    // maps to (9,3) which has both player and item.
    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 640, clientY: 400, button: 0,
          pointerType: 'mouse', pointerId: 1, bubbles: true, cancelable: true,
        }),
      );
    });

    const after = await page.evaluate(() => ({
      atk: window.__wyrdloom.playerAtk,
      equipped: window.__wyrdloom.equipped,
      ground: window.__wyrdloom.groundItems,
    }));

    expect(after.equipped).toHaveLength(1);
    expect(after.equipped[0]).toMatchObject({ slot: 'weapon', name: 'Honed Iron Sword of Malice' });
    // Honed Iron Sword of Malice → 25 + 10 + Honed(5..10) + Malice(1..4) = 41..49
    expect(after.atk).toBeGreaterThanOrEqual(41);
    expect(after.atk).toBeLessThanOrEqual(49);
    expect(after.ground).toHaveLength(0);
  });

  test('equipping a different weapon replaces the previous one (drops to ground)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    // Drop and equip the first weapon as in the prior test.
    await page.evaluate((s) => window.__wyrdloom.dev.forceDrop(s), WEAPON_SEED);
    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 832, clientY: 400, button: 0,
          pointerType: 'mouse', pointerId: 1, bubbles: true, cancelable: true,
        }),
      );
    });
    await page.waitForFunction(
      () => window.__wyrdloom.playerTile.tx === 9 && window.__wyrdloom.playerTile.ty === 3,
      undefined,
      { timeout: 3000 },
    );
    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 640, clientY: 400, button: 0,
          pointerType: 'mouse', pointerId: 1, bubbles: true, cancelable: true,
        }),
      );
    });
    await page.waitForFunction(() => window.__wyrdloom.equipped.length === 1);

    // Drop a second weapon directly on the player's tile to avoid enemy-tile
    // drift confusing the test. weapon-seed-12 → Rusty Dagger (common, 5 dmg,
    // no affixes).
    await page.evaluate(() => {
      const p = window.__wyrdloom.playerTile;
      window.__wyrdloom.dev.forceDrop('weapon-seed-12', p);
    });
    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 640, clientY: 400, button: 0,
          pointerType: 'mouse', pointerId: 1, bubbles: true, cancelable: true,
        }),
      );
    });

    const state = await page.evaluate(() => ({
      atk: window.__wyrdloom.playerAtk,
      equipped: window.__wyrdloom.equipped,
      ground: window.__wyrdloom.groundItems,
    }));
    expect(state.equipped).toHaveLength(1);
    expect(state.equipped[0]?.name).toBe('Rusty Dagger');
    // Replaced weapon drops back on the player tile.
    expect(state.ground).toHaveLength(1);
    expect(state.ground[0]?.name).toBe('Honed Iron Sword of Malice');
    // atk = 25 + 5 (Rusty Dagger baseDamage) = 30 (no affixes on common)
    expect(state.atk).toBe(30);
  });
});
