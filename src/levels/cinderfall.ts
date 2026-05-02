// Cinderfall — Act III dungeon biome (the "Ruined Keep" per spec §4.5).
// Same BSP procgen scaffolding as Catacombs / Frostvein; the biome distinction
// is currently the doorway target plus a warm-amber color grade in main.ts's
// applyZoneFilter.
//
// Boss room hosts the Pact-Bearer (act-final boss; v0.9.0). Default seed
// `cinderfall-1` produces a layout deterministic across reloads — same
// determinism contract as the other procgen zones (spec §4.5).

import { generateDungeon, roomCenter } from '../systems/procgen';
import type { Zone } from '../systems/zone';

const W = 32;
const H = 32;

export function makeCinderfallZone(seed: string): Zone {
  const map = generateDungeon({ w: W, h: H, seed });
  const entry = roomCenter(map.entrance);
  return {
    id: 'cinderfall',
    map,
    playerEntry: entry,
    // Doorway back to Whitestone — same pattern as Catacombs / Frostvein.
    // The Act III hub (Lasthold) is reserved for v0.10.0; for v0.9.0 the
    // descent continues straight from Whitestone.
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
