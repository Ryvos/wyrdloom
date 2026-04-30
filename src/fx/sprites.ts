// Placeholder Graphics-based sprites until real Kenney/LPC art lands.
// Each function returns a fresh Container — call once per actor.

import { Container, Graphics } from 'pixi.js';
import { TILE_H } from '../engine/iso';

export function makePlayerSprite(): Container {
  const c = new Container();
  // Body
  const body = new Graphics();
  body.rect(-6, -TILE_H / 2 + 8, 12, 14).fill(0x6b8a64).stroke({ color: 0x1a1814, width: 1.5 });
  // Head
  body.circle(0, -TILE_H / 2, 7).fill(0xc7b27a).stroke({ color: 0x1a1814, width: 1.5 });
  // Cloak shadow
  body.rect(-7, -TILE_H / 2 + 12, 14, 4).fill({ color: 0x1a1814, alpha: 0.3 });
  c.addChild(body);
  return c;
}

export function makeEnemySprite(): Container {
  const c = new Container();
  const body = new Graphics();
  // Hunched body — slightly squatter than player
  body.rect(-7, -TILE_H / 2 + 10, 14, 12).fill(0x4a3a4a).stroke({ color: 0x1a1814, width: 1.5 });
  // Skull-ish head
  body.circle(0, -TILE_H / 2 + 2, 6).fill(0xd8d2bf).stroke({ color: 0x1a1814, width: 1.5 });
  // Eye sockets
  body.rect(-3, -TILE_H / 2 + 1, 1.5, 2).fill(0x1a1814);
  body.rect(1.5, -TILE_H / 2 + 1, 1.5, 2).fill(0x1a1814);
  c.addChild(body);
  return c;
}

// Square attack-flash overlay; tweens via the caller.
export function makeHitFlash(): Graphics {
  const g = new Graphics();
  g.rect(-10, -TILE_H / 2 - 2, 20, 22).fill({ color: 0xfff2c2, alpha: 0.7 });
  g.visible = false;
  return g;
}
