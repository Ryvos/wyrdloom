// Whitestone — the Act I town hub. Hand-authored 16×16: an outer wall, an
// open courtyard, an NPC at the centre (the Quest-board), and a doorway tile
// to the south that transitions to the catacombs.
//
// Per spec §5: "Town hubs: Whitestone (I), Frostmoor (II), Lasthold (III).
// 4 services per hub: Smith, Imbuer, Stash, Quest-board." v0.6.0 ships only
// the Quest-board NPC; the other three are placeholders that get
// implementations in v0.7.0–v0.8.0 per spec §10.

import type { DungeonMap, Tile, Rect } from '../systems/procgen';
import type { Zone } from '../systems/zone';

const W = 16;
const H = 16;

// Doorway tile — floor, but tagged in the Zone's doorway list.
const DOORWAY_TILE = { tx: 8, ty: 14 } as const;

function buildTiles(): Tile[][] {
  const tiles: Tile[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => 'wall' as Tile),
  );
  // Carve interior — everything except the outer ring is floor.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      tiles[y]![x] = 'floor';
    }
  }
  return tiles;
}

const COURTYARD: Rect = { x: 1, y: 1, w: W - 2, h: H - 2 };

export function makeWhitestoneZone(): Zone {
  const tiles = buildTiles();
  const map: DungeonMap = {
    w: W,
    h: H,
    tiles: tiles.map((row) => Object.freeze(row.slice())) as ReadonlyArray<ReadonlyArray<Tile>>,
    rooms: [COURTYARD] as ReadonlyArray<Rect>,
    entrance: COURTYARD,
    boss: COURTYARD, // hub has no boss; reuse the courtyard rect
    seed: 'whitestone-hand-authored',
  };
  return {
    id: 'whitestone',
    map,
    // First-time entry — front-and-centre.
    playerEntry: { tx: 8, ty: 8 },
    doorways: [
      {
        tx: DOORWAY_TILE.tx,
        ty: DOORWAY_TILE.ty,
        target: 'catacombs',
        label: 'Catacombs entrance',
      },
    ],
    // When returning from the catacombs, drop in next to the doorway.
    entryFromZone: {
      catacombs: { tx: 8, ty: 13 },
    },
  };
}

// NPC placement — the Quest-board lives in the courtyard centre.
export const WHITESTONE_NPCS = [
  {
    id: 'questboard',
    kind: 'questboard' as const,
    name: 'Quest-board',
    tile: { tx: 8, ty: 7 },
  },
] as const;
