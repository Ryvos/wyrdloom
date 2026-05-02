// Catacombs tile renderer — floor + wall sprites drawn procedurally per ADR
// 0003. Walls stack a 24px-tall block on top of a floor diamond so they
// occlude actors behind them via depth-sort.

import { Container, Graphics } from 'pixi.js';
import { TILE_W, TILE_H, tileToScreen, depthFor } from '../engine/iso';
import type { DungeonMap } from '../systems/procgen';

const FLOOR_LIGHT = 0x2c2826;
const FLOOR_DARK = 0x231f1d;
const FLOOR_LINE = 0x4a463d;
const WALL_TOP = 0x5a514a;
const WALL_FACE = 0x3d3631;
const WALL_LINE = 0x1a1612;
const WALL_HEIGHT = 22;

// Render every tile of the map into `world`. Returns a flat list of the
// created Containers so callers can dispose on regen if we ever support it.
export function drawDungeon(world: Container, map: DungeonMap): Container[] {
  const created: Container[] = [];
  for (let ty = 0; ty < map.h; ty++) {
    const row = map.tiles[ty];
    if (!row) continue;
    for (let tx = 0; tx < map.w; tx++) {
      const tile = row[tx];
      if (tile === 'wall') {
        // Skip walls that aren't visible from any walkable neighbour — saves
        // ~70% of wall draw calls for a typical BSP layout. A wall is "exposed"
        // if any 4-connected neighbour is floor (or off-map, since the player
        // sees the cliff edge).
        if (!isExposedWall(map, tx, ty)) continue;
        const wall = makeWallSprite();
        const { sx, sy } = tileToScreen(tx, ty);
        wall.position.set(sx, sy);
        wall.zIndex = depthFor(tx, ty) + 0.7; // above actors on the same tile
        world.addChild(wall);
        created.push(wall);
      } else {
        const floor = makeFloorSprite((tx + ty) % 2 === 0);
        const { sx, sy } = tileToScreen(tx, ty);
        floor.position.set(sx, sy);
        floor.zIndex = depthFor(tx, ty);
        world.addChild(floor);
        created.push(floor);
      }
    }
  }
  return created;
}

function isExposedWall(map: DungeonMap, tx: number, ty: number): boolean {
  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];
  for (let i = 0; i < 4; i++) {
    const nx = tx + dx[i]!;
    const ny = ty + dy[i]!;
    if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue; // edge: hide
    const row = map.tiles[ny];
    if (row && row[nx] === 'floor') return true;
  }
  return false;
}

function makeFloorSprite(checker: boolean): Graphics {
  const g = new Graphics();
  g.poly([
    { x: 0, y: -TILE_H / 2 },
    { x: TILE_W / 2, y: 0 },
    { x: 0, y: TILE_H / 2 },
    { x: -TILE_W / 2, y: 0 },
  ]);
  g.fill(checker ? FLOOR_LIGHT : FLOOR_DARK);
  g.stroke({ color: FLOOR_LINE, width: 1, alpha: 0.4 });
  return g;
}

function makeWallSprite(): Container {
  const c = new Container();

  // Side faces (left + right) drawn first so the top diamond overpaints them.
  const faces = new Graphics();
  faces.poly([
    { x: -TILE_W / 2, y: 0 },
    { x: 0, y: TILE_H / 2 },
    { x: 0, y: TILE_H / 2 - WALL_HEIGHT },
    { x: -TILE_W / 2, y: -WALL_HEIGHT },
  ]);
  faces.fill(WALL_FACE);
  faces.stroke({ color: WALL_LINE, width: 1, alpha: 0.6 });
  faces.poly([
    { x: TILE_W / 2, y: 0 },
    { x: 0, y: TILE_H / 2 },
    { x: 0, y: TILE_H / 2 - WALL_HEIGHT },
    { x: TILE_W / 2, y: -WALL_HEIGHT },
  ]);
  faces.fill({ color: WALL_FACE, alpha: 0.85 });
  faces.stroke({ color: WALL_LINE, width: 1, alpha: 0.6 });
  c.addChild(faces);

  // Top diamond
  const top = new Graphics();
  top.poly([
    { x: 0, y: -TILE_H / 2 - WALL_HEIGHT },
    { x: TILE_W / 2, y: -WALL_HEIGHT },
    { x: 0, y: TILE_H / 2 - WALL_HEIGHT },
    { x: -TILE_W / 2, y: -WALL_HEIGHT },
  ]);
  top.fill(WALL_TOP);
  top.stroke({ color: WALL_LINE, width: 1, alpha: 0.7 });
  c.addChild(top);

  return c;
}
