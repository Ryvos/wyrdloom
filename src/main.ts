// WYRDLOOM v0.1.0 spike — Pixi iso canvas + click-to-move.
// Placeholder graphics (no external sprites yet) so the bundle stays hermetic
// and the spike is reproducible from a fresh clone with no asset network fetch.

import { Application, Container, Graphics } from 'pixi.js';
import { TILE_W, TILE_H, tileToScreen, depthFor } from './engine/iso';
import { bindClickToMove } from './engine/input';
import type { TileCoord } from './engine/iso';

const GRID_W = 12;
const GRID_H = 12;

async function main(): Promise<void> {
  const host = document.getElementById('app');
  if (!host) throw new Error('#app missing');

  const app = new Application();
  await app.init({
    background: '#0a0a0c',
    resizeTo: window,
    antialias: false,
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
  });
  host.appendChild(app.canvas);

  // Camera: a Container we translate to keep the player centered.
  const camera = new Container();
  camera.label = 'camera';
  app.stage.addChild(camera);

  // World: holds tiles + actors. Sortable so depthFor() picks draw order.
  const world = new Container();
  world.label = 'world';
  world.sortableChildren = true;
  camera.addChild(world);

  drawTileGrid(world, GRID_W, GRID_H);

  // Player — a colored diamond as a placeholder until we vendor LPC.
  const player = makePlayerPlaceholder();
  let playerTile: TileCoord = { tx: 6, ty: 6 };
  placeAt(player, playerTile);
  world.addChild(player);

  // Click target indicator — visible feedback the click registered.
  const target = new Graphics();
  target.visible = false;
  world.addChild(target);

  centerCamera(app, camera, playerTile);

  // Hook click-to-move. Step one tile per frame towards target.
  let goal: TileCoord | null = null;

  bindClickToMove(world, (tile) => {
    if (tile.tx < 0 || tile.ty < 0 || tile.tx >= GRID_W || tile.ty >= GRID_H) return;
    goal = tile;
    const s = tileToScreen(tile.tx, tile.ty);
    target.clear();
    target.poly([
      { x: s.sx, y: s.sy - TILE_H / 2 },
      { x: s.sx + TILE_W / 2, y: s.sy },
      { x: s.sx, y: s.sy + TILE_H / 2 },
      { x: s.sx - TILE_W / 2, y: s.sy },
    ]);
    target.stroke({ color: 0xb88a3a, width: 2, alpha: 0.9 });
    target.zIndex = depthFor(tile.tx, tile.ty) + 1;
    target.visible = true;
  });

  // Tick: step one tile every ~150ms toward goal. Replaced by A* in Week 5.
  let stepAccum = 0;
  app.ticker.add((tick) => {
    stepAccum += tick.deltaMS;
    if (goal && stepAccum >= 150) {
      stepAccum = 0;
      const dx = Math.sign(goal.tx - playerTile.tx);
      const dy = Math.sign(goal.ty - playerTile.ty);
      // Step on whichever axis has the larger remaining gap so motion looks natural.
      if (dx === 0 && dy === 0) {
        goal = null;
        target.visible = false;
      } else if (Math.abs(goal.tx - playerTile.tx) >= Math.abs(goal.ty - playerTile.ty)) {
        playerTile = { tx: playerTile.tx + dx, ty: playerTile.ty };
      } else {
        playerTile = { tx: playerTile.tx, ty: playerTile.ty + dy };
      }
      placeAt(player, playerTile);
      centerCamera(app, camera, playerTile);
      updateDebug(playerTile, goal);
    }
  });

  updateDebug(playerTile, goal);

  // Expose for Playwright / DevTools — read-only handle, no behavior change.
  (window as unknown as { __wyrdloom: unknown }).__wyrdloom = {
    get playerTile() {
      return { ...playerTile };
    },
    get goal() {
      return goal ? { ...goal } : null;
    },
    version: '0.1.0',
  };
}

function drawTileGrid(world: Container, w: number, h: number): void {
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const tile = drawDiamond((tx + ty) % 2 === 0 ? 0x2c2a26 : 0x35322d, 0x4a463d);
      const { sx, sy } = tileToScreen(tx, ty);
      tile.position.set(sx, sy);
      tile.zIndex = depthFor(tx, ty);
      world.addChild(tile);
    }
  }
}

function drawDiamond(fill: number, stroke: number): Graphics {
  const g = new Graphics();
  g.poly([
    { x: 0, y: -TILE_H / 2 },
    { x: TILE_W / 2, y: 0 },
    { x: 0, y: TILE_H / 2 },
    { x: -TILE_W / 2, y: 0 },
  ]);
  g.fill(fill);
  g.stroke({ color: stroke, width: 1, alpha: 0.6 });
  return g;
}

function makePlayerPlaceholder(): Graphics {
  const g = new Graphics();
  g.circle(0, -TILE_H / 2, 10);
  g.fill(0xc7b27a);
  g.stroke({ color: 0x1a1814, width: 2 });
  g.rect(-6, -TILE_H / 2 + 8, 12, 14);
  g.fill(0x6b8a64);
  return g;
}

function placeAt(node: Graphics, tile: TileCoord): void {
  const { sx, sy } = tileToScreen(tile.tx, tile.ty);
  node.position.set(sx, sy);
  node.zIndex = depthFor(tile.tx, tile.ty) + 0.5;
}

function centerCamera(app: Application, camera: Container, tile: TileCoord): void {
  const { sx, sy } = tileToScreen(tile.tx, tile.ty);
  camera.position.set(app.screen.width / 2 - sx, app.screen.height / 2 - sy);
}

function updateDebug(player: TileCoord, goal: TileCoord | null): void {
  const el = document.querySelector<HTMLElement>('[data-testid="debug-readout"]');
  if (!el) return;
  const g = goal ? `${goal.tx},${goal.ty}` : '—';
  el.textContent = `tile ${player.tx},${player.ty}  goal ${g}`;
}

main().catch((err) => {
  console.error('boot failed', err);
  const el = document.querySelector<HTMLElement>('[data-testid="debug-readout"]');
  if (el) el.textContent = `boot failed: ${(err as Error).message}`;
});
