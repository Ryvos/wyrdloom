/// <reference path="../types/wyrdloom-global.d.ts" />
import { test, expect } from '@playwright/test';

const VERSION = '0.6.0';
// Same offline-probed seed as the loot tests — Honed Iron Sword of Malice.
const WEAPON_SEED = 'weapon-seed-17';

test.describe('inventory + character panels (v0.4.0)', () => {
  test('I toggles the inventory panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    const panel = page.locator('wyrd-inventory');
    await expect(panel).not.toHaveAttribute('open', '');
    await page.keyboard.press('i');
    await expect(panel).toHaveAttribute('open', '');
    await page.keyboard.press('i');
    await expect(panel).not.toHaveAttribute('open', '');
  });

  test('C toggles the character panel; Esc closes everything', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    const inv = page.locator('wyrd-inventory');
    const char = page.locator('wyrd-character');

    await page.keyboard.press('i');
    await page.keyboard.press('c');
    await expect(inv).toHaveAttribute('open', '');
    await expect(char).toHaveAttribute('open', '');

    await page.keyboard.press('Escape');
    await expect(inv).not.toHaveAttribute('open', '');
    await expect(char).not.toHaveAttribute('open', '');
  });

  test('giveItem populates the bag and panel renders the cell', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    await page.evaluate((s) => window.__wyrdloom.dev.giveItem(s), WEAPON_SEED);
    await page.evaluate(() => window.__wyrdloom.dev.openPanel('inventory'));

    const bag = await page.evaluate(() => window.__wyrdloom.inventory);
    expect(bag).toHaveLength(1);
    expect(bag[0]).toMatchObject({ name: 'Honed Iron Sword of Malice', x: 0, y: 0 });

    // The (0,0) inventory cell shows the W glyph (weapon).
    const cell = page.locator('wyrd-inventory').locator('[data-testid="inv-cell-0-0"]');
    await expect(cell).toBeVisible();
    await expect(cell.locator('.glyph')).toHaveText('W');
  });

  test('clicking an inventory cell equips the item and bumps atk', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    await page.evaluate((s) => window.__wyrdloom.dev.giveItem(s), WEAPON_SEED);
    await page.evaluate(() => window.__wyrdloom.dev.openPanel('inventory'));

    expect(await page.evaluate(() => window.__wyrdloom.playerAtk)).toBe(25);

    await page.locator('wyrd-inventory').locator('[data-testid="inv-cell-0-0"]').click();

    await page.waitForFunction(() => window.__wyrdloom.equipped.length === 1);
    const after = await page.evaluate(() => ({
      atk: window.__wyrdloom.playerAtk,
      bag: window.__wyrdloom.inventory,
      equipped: window.__wyrdloom.equipped,
    }));
    expect(after.bag).toHaveLength(0);
    expect(after.equipped[0]).toMatchObject({
      slot: 'weapon',
      name: 'Honed Iron Sword of Malice',
    });
    // Honed Iron Sword of Malice → 25 + 10 + Honed(5..10) + Malice(1..4) = 41..49
    expect(after.atk).toBeGreaterThanOrEqual(41);
    expect(after.atk).toBeLessThanOrEqual(49);
  });

  test('character sheet shows equipped weapon; click unequips back to bag', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    await page.evaluate((s) => window.__wyrdloom.dev.giveItem(s), WEAPON_SEED);
    await page.evaluate(() => {
      const uid = window.__wyrdloom.inventory[0]!.uid;
      window.__wyrdloom.dev.equipFromInventoryByUid(uid);
    });
    await page.evaluate(() => window.__wyrdloom.dev.openPanel('character'));

    const slot = page.locator('wyrd-character').locator('[data-testid="paperdoll-weapon"]');
    await expect(slot).toBeVisible();
    await expect(slot).toHaveClass(/equipped/);
    await expect(slot.locator('.name')).toContainText('Honed Iron Sword');

    await slot.click();
    await page.waitForFunction(() => window.__wyrdloom.equipped.length === 0);

    const after = await page.evaluate(() => ({
      bag: window.__wyrdloom.inventory,
      equipped: window.__wyrdloom.equipped,
      atk: window.__wyrdloom.playerAtk,
    }));
    expect(after.equipped).toHaveLength(0);
    expect(after.bag).toHaveLength(1);
    expect(after.atk).toBe(25);
  });

  test('right-click an inventory cell drops the item to the floor', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    await page.evaluate((s) => window.__wyrdloom.dev.giveItem(s), WEAPON_SEED);
    await page.evaluate(() => window.__wyrdloom.dev.openPanel('inventory'));

    await page.locator('wyrd-inventory')
      .locator('[data-testid="inv-cell-0-0"]')
      .click({ button: 'right' });

    await page.waitForFunction(() => window.__wyrdloom.groundItems.length === 1);
    const after = await page.evaluate(() => ({
      bag: window.__wyrdloom.inventory,
      ground: window.__wyrdloom.groundItems,
    }));
    expect(after.bag).toHaveLength(0);
    expect(after.ground[0]).toMatchObject({
      name: 'Honed Iron Sword of Malice',
      // v0.6.0: player boots into Whitestone hub at (8, 8).
      tile: { tx: 8, ty: 8 },
    });
  });
});

test.describe('hotbar + bind flow (v0.4.0)', () => {
  test('clicking an empty hotbar slot opens the bind panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    const bind = page.locator('wyrd-bind');
    await expect(bind).not.toHaveAttribute('open', '');

    await page.locator('wyrd-hotbar').locator('[data-testid="hotbar-0"]').click();
    await expect(bind).toHaveAttribute('open', '');
  });

  test('binding a skill from the panel writes into gameState.hotbar', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    await page.locator('wyrd-hotbar').locator('[data-testid="hotbar-2"]').click();
    await page.locator('wyrd-bind').locator('[data-testid="bind-skill-melee"]').click();

    const hb = await page.evaluate(() => window.__wyrdloom.hotbar);
    expect(hb[0]).toBeNull();
    expect(hb[1]).toBeNull();
    expect(hb[2]).toMatchObject({ skillId: 'melee' });
    expect(hb[3]).toBeNull();
  });

  test('right-click a bound hotbar slot clears the binding', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);

    // Bind first.
    await page.locator('wyrd-hotbar').locator('[data-testid="hotbar-0"]').click();
    await page.locator('wyrd-bind').locator('[data-testid="bind-skill-melee"]').click();
    expect(await page.evaluate(() => window.__wyrdloom.hotbar[0])).not.toBeNull();

    // Right-click to unbind.
    await page.locator('wyrd-hotbar')
      .locator('[data-testid="hotbar-0"]')
      .click({ button: 'right' });

    expect(await page.evaluate(() => window.__wyrdloom.hotbar[0])).toBeNull();
  });
});
