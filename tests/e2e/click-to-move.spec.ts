import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    __wyrdloom: {
      readonly playerTile: { tx: number; ty: number };
      readonly goal: { tx: number; ty: number } | null;
      readonly version: string;
    };
  }
}

test.describe('v0.1.0 spike', () => {
  test('boots without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForFunction(() => window.__wyrdloom?.version === '0.1.0');

    // Allow the ticker to run for a beat — catches any post-init exceptions.
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });

  test('player spawns at (6,6)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__wyrdloom?.version === '0.1.0');
    const tile = await page.evaluate(() => window.__wyrdloom.playerTile);
    expect(tile).toEqual({ tx: 6, ty: 6 });
  });

  test('left-click on canvas moves the player to the clicked tile', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__wyrdloom?.version === '0.1.0');

    // Dispatch a synthetic pointerdown at viewport (700, 450).
    // With a 1280x800 viewport, the iso math (TILE_W=64, TILE_H=32, spawn at 6,6
    // which centers the camera) maps that pixel to tile (9, 7).
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('no canvas');
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 700,
          clientY: 450,
          button: 0,
          pointerType: 'mouse',
          pointerId: 1,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    // Goal is set immediately on click, before any tick fires.
    const goal = await page.evaluate(() => window.__wyrdloom.goal);
    expect(goal).toEqual({ tx: 9, ty: 7 });

    // Step ticker is 150ms; (6,6) -> (9,7) is 4 manhattan steps; allow generous slack.
    await page.waitForFunction(
      () => {
        const w = window.__wyrdloom;
        return w.playerTile.tx === 9 && w.playerTile.ty === 7 && w.goal === null;
      },
      { timeout: 3000 },
    );

    const final = await page.evaluate(() => window.__wyrdloom.playerTile);
    expect(final).toEqual({ tx: 9, ty: 7 });
  });

  test('out-of-bounds clicks are ignored', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__wyrdloom?.version === '0.1.0');

    // Click way off the grid.
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('no canvas');
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 10,
          clientY: 10,
          button: 0,
          pointerType: 'mouse',
          pointerId: 1,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await page.waitForTimeout(200);
    const goal = await page.evaluate(() => window.__wyrdloom.goal);
    // Out-of-bounds should leave goal as null (handler bails before assignment).
    expect(goal).toBeNull();
  });
});
