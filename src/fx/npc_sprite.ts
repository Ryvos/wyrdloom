// Procedural NPC sprites — placeholders until LPC art lands (ADR 0003).
// Each NPC kind has a distinct silhouette so they're recognizable on a
// distant viewport without a label.

import { Container, Graphics } from 'pixi.js';
import { TILE_H } from '../engine/iso';
import type { NpcKind } from '../actors/Npc';

export function makeNpcSprite(kind: NpcKind): Container {
  const c = new Container();
  const body = new Graphics();
  switch (kind) {
    case 'questboard':
      // Tall narrow board on a post — readable as "billboard".
      body.rect(-9, -TILE_H / 2 - 8, 18, 18).fill(0x8a7a55).stroke({ color: 0x1a1814, width: 1.5 });
      body.rect(-1, -TILE_H / 2 + 10, 2, 8).fill(0x4a3a26);
      // 3 rune marks
      body.rect(-6, -TILE_H / 2 - 4, 4, 1).fill(0xc7b27a);
      body.rect(-6, -TILE_H / 2 - 1, 6, 1).fill(0xc7b27a);
      body.rect(-6, -TILE_H / 2 + 2, 5, 1).fill(0xc7b27a);
      break;
    case 'smith':
      // Anvil + figure
      body.rect(-7, -TILE_H / 2 + 8, 14, 12).fill(0x6a5d4f).stroke({ color: 0x1a1814, width: 1.5 });
      body.circle(0, -TILE_H / 2, 6).fill(0xc7b27a).stroke({ color: 0x1a1814, width: 1.5 });
      body.rect(-3, -TILE_H / 2 + 14, 6, 4).fill(0x4a463d);
      break;
    case 'imbuer':
      // Robed figure
      body.poly([
        { x: -8, y: TILE_H / 2 + 8 },
        { x: 8, y: TILE_H / 2 + 8 },
        { x: 5, y: -TILE_H / 2 + 4 },
        { x: -5, y: -TILE_H / 2 + 4 },
      ]).fill(0x4a3a6a).stroke({ color: 0x1a1814, width: 1.5 });
      body.circle(0, -TILE_H / 2 - 2, 5).fill(0xc7b27a).stroke({ color: 0x1a1814, width: 1.5 });
      break;
    case 'stash':
      // Chest
      body.rect(-9, -TILE_H / 2 + 6, 18, 14).fill(0x6a5530).stroke({ color: 0x1a1814, width: 1.5 });
      body.rect(-9, -TILE_H / 2 + 6, 18, 4).fill(0x4a3826);
      body.rect(-2, -TILE_H / 2 + 13, 4, 4).fill(0xc7b27a);
      break;
  }
  c.addChild(body);
  return c;
}
