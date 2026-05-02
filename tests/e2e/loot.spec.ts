/// <reference path="../types/wyrdloom-global.d.ts" />
import { test, expect } from '@playwright/test';

const VERSION = '0.4.0';
// Seed handpicked from offline probe — yields a magic Honed Iron Sword of Malice
// (weapon, baseDamage 10, +Honed atk_flat, +of-Malice atk_flat).
const WEAPON_SEED = 'weapon-seed-17';

test.describe('loot pipeline (v0.4.0 — pickup goes into bag)', () => {
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

  test('walking onto a ground item then clicking it picks up into the bag', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    const initial = await page.evaluate(() => ({
      atk: window.__wyrdloom.playerAtk,
      bag: window.__wyrdloom.inventory,
      equipped: window.__wyrdloom.equipped,
    }));
    expect(initial.atk).toBe(25);
    expect(initial.bag).toHaveLength(0);
    expect(initial.equipped).toHaveLength(0);

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

    // Second click: pickup. Camera now centered on (9,3), so viewport (640,400)
    // maps to (9,3) which has both player and item.
    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 640, clientY: 400, button: 0,
          pointerType: 'mouse', pointerId: 1, bubbles: true, cancelable: true,
        }),
      );
    });

    await page.waitForFunction(() => window.__wyrdloom.inventory.length === 1);
    const after = await page.evaluate(() => ({
      atk: window.__wyrdloom.playerAtk,
      bag: window.__wyrdloom.inventory,
      equipped: window.__wyrdloom.equipped,
      ground: window.__wyrdloom.groundItems,
    }));
    // Item is in the bag — but NOT auto-equipped, so atk stays at base 25.
    expect(after.bag).toHaveLength(1);
    expect(after.bag[0]).toMatchObject({
      name: 'Honed Iron Sword of Malice',
      slot: 'weapon',
      x: 0,
      y: 0,
    });
    expect(after.equipped).toHaveLength(0);
    expect(after.atk).toBe(25);
    expect(after.ground).toHaveLength(0);
  });
});
