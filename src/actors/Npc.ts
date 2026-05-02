// NPCs are non-combatant tile-bound actors that the player can talk to. v0.6.0
// ships only the Quest-board NPC; v0.7.0 adds Smith / Imbuer / Stash with
// real service panels.
//
// Pure data — the view layer reads this and renders. NPCs don't move,
// don't attack, and don't take damage; they sit at a tile until interacted
// with. The Pixi sprite + the Lit dialog panel both consume `NpcDef`.

import type { TileCoord } from '../engine/iso';

export type NpcKind = 'questboard' | 'smith' | 'imbuer' | 'stash' | 'wyrdkeeper';

export interface NpcDef {
  readonly id: string;
  readonly kind: NpcKind;
  readonly name: string;
  readonly tile: TileCoord;
}

// Static greeting + one-line tease per NPC. The Quest-board has the only
// real interaction in v0.6.0 — the others render a "service coming in
// v0.7.0" placeholder panel so players don't think they're broken.
export const NPC_DIALOG: Record<NpcKind, { greeting: string; teaser: string }> = {
  questboard: {
    greeting: 'Whitestone Quest-board',
    teaser: 'Click an active quest to track it. Speak again on completion.',
  },
  smith: {
    greeting: 'Smith',
    teaser: 'My forge is cold for now. Return in v0.7.0 with materials.',
  },
  imbuer: {
    greeting: 'Imbuer',
    teaser: 'Three magic trinkets become a rare. Empty sockets take gems.',
  },
  stash: {
    greeting: 'Stash-keeper',
    teaser: '4 tabs × 10×10 storage — wired up in v0.7.0.',
  },
  wyrdkeeper: {
    greeting: 'The Wyrdkeeper',
    teaser: 'Bring me a sigil. The Echo will hear.',
  },
};
