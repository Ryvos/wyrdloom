// Frostvein Caves — Act II dungeon biome. Per spec §4.5: same BSP procgen as
// Catacombs but tagged for the frostvein biome (which today only changes the
// color grade and the doorway target). v0.7.0 ships a single floor; multi-
// floor + hidden-room tagging lands in v0.7.x with the rest of §4.5 polish.
//
// Default seed `frostvein-1` produces a layout deterministic across reloads —
// same property the Catacombs uses for save/load determinism (spec §4.5).

import { generateDungeon, roomCenter } from '../systems/procgen';
import type { Zone } from '../systems/zone';

const W = 32;
const H = 32;

export function makeFrostveinZone(seed: string): Zone {
  const map = generateDungeon({ w: W, h: H, seed });
  const entry = roomCenter(map.entrance);
  return {
    id: 'frostvein',
    map,
    playerEntry: entry,
    // Doorway back to Whitestone — same pattern as Catacombs.
    doorways: [
      {
        tx: entry.tx,
        ty: entry.ty,
        target: 'whitestone',
        label: 'Surface',
      },
    ],
    entryFromZone: {
      whitestone: entry,
    },
  };
}

export function bossRoomCenter(zone: Zone): { tx: number; ty: number } {
  return roomCenter(zone.map.boss);
}
