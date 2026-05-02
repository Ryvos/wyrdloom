// The Echo — endless endgame dungeon (spec §4.7). Shares the Catacombs
// biome per spec §4.5 ("Catacombs (Act I + Echo)"), but each entry is seeded
// from the consumed sigil's tier so the floor reads procgen-fresh.
//
// Floor sequence:
//   - Floors 1-4: progressively scaled grunt packs.
//   - Floor 5: Pinnacle boss room (per spec §5: "Pinnacle every 5 floors").
//
// Tier scaling tilts monsterLevel + drop weights via the rollDrop ctx — the
// zone module just owns map generation + entry/exit semantics.
//
// The Echo doorway-back leads to Whitestone; any "next floor" doorway loops
// back into this zone with `floor + 1` until floor 5 is cleared.

import { generateDungeon, roomCenter } from '../systems/procgen';
import type { Zone } from '../systems/zone';

const W = 32;
const H = 32;

export function makeEchoZone(args: {
  readonly tier: number;
  readonly floor: number;
}): Zone {
  // Distinct seed per (tier, floor) — same tier replay produces the same
  // floor layout, supporting "echo cleared" bookkeeping later if needed.
  const seed = `echo-t${args.tier}-f${args.floor}`;
  const map = generateDungeon({ w: W, h: H, seed });
  const entry = roomCenter(map.entrance);
  return {
    id: 'echo',
    map,
    playerEntry: entry,
    // Single exit doorway back to Whitestone — the player can always bail.
    // The "next floor" advance is triggered by the Pinnacle/floor-end in
    // main.ts rather than by stepping on a floor tile, so it stays out of
    // this Zone's static doorway list.
    doorways: [
      {
        tx: entry.tx,
        ty: entry.ty,
        target: 'whitestone',
        label: 'Leave the Echo',
      },
    ],
    entryFromZone: {
      whitestone: entry,
    },
  };
}
