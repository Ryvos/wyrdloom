// Catacombs — Act I dungeon. BSP procgen via src/systems/procgen.ts; this
// module wraps the raw DungeonMap into a Zone with a doorway back to
// Whitestone placed at the entrance-room centre.

import { generateDungeon, roomCenter } from '../systems/procgen';
import type { Zone } from '../systems/zone';

const W = 32;
const H = 32;

export function makeCatacombsZone(seed: string): Zone {
  const map = generateDungeon({ w: W, h: H, seed });
  const entry = roomCenter(map.entrance);
  return {
    id: 'catacombs',
    map,
    // First-time entry from a new-game flow lands at the entrance room.
    playerEntry: entry,
    // The doorway back to Whitestone is the entrance-room tile next to the
    // player's spawn — stepping on it in either direction triggers transition.
    // We place it on the entry tile itself; the click handler ignores the
    // doorway when the player is *already on it* and only fires on the next
    // step away/onto so it doesn't loop.
    doorways: [
      {
        tx: entry.tx,
        ty: entry.ty,
        target: 'whitestone',
        label: 'Surface',
      },
    ],
    // When entering from Whitestone, place player at the entrance room.
    // When (later) coming from a deeper floor, we'd add another entry here.
    entryFromZone: {
      whitestone: entry,
    },
    // Stash boss-room tile in entryFromZone-style metadata? The boss room is
    // map.boss; consumers read it directly off `zone.map.boss`. (The Hollow
    // Bishop spawns there.)
  };
}

export function bossRoomCenter(zone: Zone): { tx: number; ty: number } {
  return roomCenter(zone.map.boss);
}
