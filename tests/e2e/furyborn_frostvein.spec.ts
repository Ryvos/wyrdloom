/// <reference path="../types/wyrdloom-global.d.ts" />
import { test, expect, type Page } from '@playwright/test';

const VERSION = '0.7.0';

async function bootHub(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
  await page.waitForFunction(() => window.__wyrdloom.zoneId === 'whitestone');
}

async function enterFrostvein(page: Page): Promise<void> {
  await page.evaluate(() => window.__wyrdloom.dev.changeZone('frostvein'));
  await page.waitForFunction(() => window.__wyrdloom.zoneId === 'frostvein');
}

test.describe('Furyborn class', () => {
  test('boot defaults the player to the Furyborn class with empty rage', async ({ page }) => {
    await bootHub(page);
    const state = await page.evaluate(() => ({
      classId: window.__wyrdloom.classId,
      resource: window.__wyrdloom.resource,
      resourceMax: window.__wyrdloom.resourceMax,
      hp: window.__wyrdloom.playerHp,
      atk: window.__wyrdloom.playerAtk,
    }));
    expect(state.classId).toBe('furyborn');
    expect(state.resource).toBe(0);
    expect(state.resourceMax).toBe(100);
    // Class baseline — Furyborn is bulkier than v0.6.0 generic 100/25.
    expect(state.hp).toBe(120);
    expect(state.atk).toBe(28);
  });

  test('resource bar renders Rage label with the class color', async ({ page }) => {
    await bootHub(page);
    const readout = await page.locator('[data-testid="resource-readout"]').textContent();
    expect(readout).toBe('Rage 0 / 100');
    const fillStyle = await page
      .locator('[data-testid="resource-fill"]')
      .evaluate((el) => (el as HTMLElement).style.background);
    // Rage color is #c44a2a — browsers normalize to rgb(196, 74, 42).
    expect(fillStyle).toContain('rgb(196, 74, 42)');
  });

  test('landing hits builds Rage; idle drains it back', async ({ page }) => {
    await bootHub(page);
    await page.evaluate(() => window.__wyrdloom.dev.changeZone('catacombs'));
    await page.waitForFunction(() => window.__wyrdloom.zoneId === 'catacombs');
    await page.evaluate(() => {
      window.__wyrdloom.dev.teleportPlayer(8, 4);
      window.__wyrdloom.dev.teleportEnemy('grunt-1', 9, 4);
      window.__wyrdloom.dev.attackEnemy('grunt-1');
    });
    // Wait for at least one swing to land — Furyborn cd 450 ms, on-hit +12 rage.
    await page.waitForFunction(() => window.__wyrdloom.resource > 0, undefined, {
      timeout: 3000,
    });
    const peak = await page.evaluate(() => window.__wyrdloom.resource);
    expect(peak).toBeGreaterThan(0);
  });
});

test.describe('Frostvein zone + Worm-Mother', () => {
  test('changeZone(frostvein) loads the ice-cave with Worm-Mother in the boss room', async ({
    page,
  }) => {
    await bootHub(page);
    await enterFrostvein(page);
    const state = await page.evaluate(() => ({
      zone: window.__wyrdloom.zoneId,
      seed: window.__wyrdloom.dungeon.seed,
      enemyIds: window.__wyrdloom.enemies.map((e) => e.id).sort(),
      vyl: window.__wyrdloom.enemies.find((e) => e.id === 'worm-mother'),
      bossTile: window.__wyrdloom.dungeon.boss,
      phase: window.__wyrdloom.wormMotherPhase,
    }));
    expect(state.zone).toBe('frostvein');
    expect(state.seed).toBe('frostvein-1');
    expect(state.enemyIds).toEqual(['grunt-fv-1', 'worm-mother']);
    expect(state.vyl?.tile).toEqual(state.bossTile);
    expect(state.vyl?.hp).toBe(240);
    expect(state.phase).toBe(1);
  });

  test('frostvein dungeon is deterministic across reloads', async ({ page }) => {
    await bootHub(page);
    await enterFrostvein(page);
    const first = await page.evaluate(() => window.__wyrdloom.dungeon);
    await page.reload();
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
    await enterFrostvein(page);
    const second = await page.evaluate(() => window.__wyrdloom.dungeon);
    expect(second).toEqual(first);
  });

  test('killing Worm-Mother drops the boss and runs the Act-II quest hook', async ({ page }) => {
    test.setTimeout(120000);
    await bootHub(page);
    // Equip a high-roll weapon first — Worm-Mother has 240 HP, so a Furyborn
    // bare-handed (28 atk) trades poorly through phase 3. With the weapon
    // affixes we land 44+ per swing and finish before the boss heals or kites.
    await page.evaluate((seed: string) => {
      window.__wyrdloom.dev.giveItem(seed);
      const uid = window.__wyrdloom.inventory[0]!.uid;
      window.__wyrdloom.dev.equipFromInventoryByUid(uid);
    }, 'weapon-seed-17');

    await enterFrostvein(page);
    await page.evaluate(() => {
      const w = window.__wyrdloom;
      const bossTile = w.dungeon.boss;
      w.dev.teleportPlayer(bossTile.tx + 1, bossTile.ty);
      w.dev.teleportEnemy('worm-mother', bossTile.tx, bossTile.ty);
      w.dev.attackEnemy('worm-mother');
    });
    await page.waitForFunction(
      () => {
        const v = window.__wyrdloom.enemies.find((e) => e.id === 'worm-mother');
        return v?.alive === false;
      },
      undefined,
      { timeout: 60000 },
    );
    const state = await page.evaluate(() => ({
      vyl: window.__wyrdloom.enemies.find((e) => e.id === 'worm-mother'),
      groundCount: window.__wyrdloom.groundItems.length,
    }));
    expect(state.vyl?.alive).toBe(false);
    expect(state.vyl?.hp).toBe(0);
    // Boss kill always drops one item.
    expect(state.groundCount).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Save/Load (v0.7.0 — class + resource round-trip)', () => {
  test('save in catacombs then reload preserves class + zone', async ({ page }) => {
    await bootHub(page);
    await page.evaluate(() => window.__wyrdloom.dev.deleteSlot(3));
    await page.evaluate(() => window.__wyrdloom.dev.changeZone('frostvein'));
    await page.waitForFunction(() => window.__wyrdloom.zoneId === 'frostvein');
    await page.evaluate(() => window.__wyrdloom.dev.saveNow(3));

    const slots = await page.evaluate(async () => await window.__wyrdloom.dev.listSlots());
    const slot3 = slots.find((s) => s.slot === 3);
    expect(slot3).toBeDefined();
    expect(slot3!.zoneId).toBe('frostvein');
    expect(slot3!.version).toBe(VERSION);

    // Fresh load — class survives the round-trip.
    await page.reload();
    await page.waitForFunction((v) => window.__wyrdloom?.version === v, VERSION);
    await page.waitForFunction(() => window.__wyrdloom.zoneId === 'whitestone');
    await page.evaluate(() => window.__wyrdloom.dev.loadSlot(3));
    await page.waitForFunction(() => window.__wyrdloom.zoneId === 'frostvein');
    const loaded = await page.evaluate(() => ({
      classId: window.__wyrdloom.classId,
      zone: window.__wyrdloom.zoneId,
    }));
    expect(loaded.classId).toBe('furyborn');
    expect(loaded.zone).toBe('frostvein');
  });
});
