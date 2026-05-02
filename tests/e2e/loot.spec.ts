/// <reference path="../types/wyrdloom-global.d.ts" />
import { test, expect } from '@playwright/test';

const VERSION = '0.9.0';
// Seed handpicked from offline probe — yields a magic Honed Iron Sword of Malice
// (weapon, baseDamage 10, +Honed atk_flat, +of-Malice atk_flat).
const WEAPON_SEED = 'weapon-seed-17';

test.describe('loot pipeline (pickup goes into bag, zone-aware)', () => {
  test('forceDrop deterministically yields the same item for a given seed', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    // Drop at the player's tile so viewport-centered click in the next test
    // hits it. Works in any zone (hub or catacombs).
    await page.evaluate((s) => {
      const p = window.__wyrdloom.playerTile;
      window.__wyrdloom.dev.forceDrop(s, p);
    }, WEAPON_SEED);
    const ground = await page.evaluate(() => window.__wyrdloom.groundItems);
    expect(ground).toHaveLength(1);
    expect(ground[0]).toMatchObject({
      name: 'Honed Iron Sword of Malice',
      rarity: 'magic',
      slot: 'weapon',
      affixCount: 2,
    });
  });

  test('hovering a ground item at the player tile shows the tooltip', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    // Drop at the player's tile so viewport (~640, 400) maps to it.
    await page.evaluate((s) => {
      const p = window.__wyrdloom.playerTile;
      window.__wyrdloom.dev.forceDrop(s, p);
    }, WEAPON_SEED);

    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2,
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

  test('clicking a ground item on the player tile picks it up into the bag', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    const initial = await page.evaluate(() => ({
      atk: window.__wyrdloom.playerAtk,
      bag: window.__wyrdloom.inventory,
    }));
    expect(initial.atk).toBe(28); // Furyborn baseline
    expect(initial.bag).toHaveLength(0);

    await page.evaluate((s) => {
      const p = window.__wyrdloom.playerTile;
      window.__wyrdloom.dev.forceDrop(s, p);
    }, WEAPON_SEED);

    // Click the canvas centered on viewport — that's the camera-tracked
    // player tile, which now also has the item.
    await page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2,
          button: 0,
          pointerType: 'mouse', pointerId: 1, bubbles: true, cancelable: true,
        }),
      );
    });

    await page.waitForFunction(() => window.__wyrdloom.inventory.length === 1);
    const after = await page.evaluate(() => ({
      atk: window.__wyrdloom.playerAtk,
      bag: window.__wyrdloom.inventory,
      ground: window.__wyrdloom.groundItems,
    }));
    expect(after.bag).toHaveLength(1);
    expect(after.bag[0]).toMatchObject({
      name: 'Honed Iron Sword of Malice',
      slot: 'weapon',
      x: 0,
      y: 0,
    });
    // Pickup is bag-only in v0.4.0+; equipping is a separate panel click.
    expect(after.atk).toBe(28);
    expect(after.ground).toHaveLength(0);
  });
});
