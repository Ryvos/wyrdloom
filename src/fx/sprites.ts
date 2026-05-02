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

export function makeHollowBishopSprite(): Container {
  const c = new Container();
  // Tall robed silhouette — clearly distinct from grunts.
  const body = new Graphics();
  body.poly([
    { x: -11, y: TILE_H / 2 + 12 },
    { x: 11, y: TILE_H / 2 + 12 },
    { x: 7, y: -TILE_H / 2 - 4 },
    { x: -7, y: -TILE_H / 2 - 4 },
  ]).fill(0x3a1a2a).stroke({ color: 0x1a0814, width: 2 });
  // Cowl over the head
  body.poly([
    { x: -8, y: -TILE_H / 2 - 4 },
    { x: 8, y: -TILE_H / 2 - 4 },
    { x: 6, y: -TILE_H / 2 - 16 },
    { x: -6, y: -TILE_H / 2 - 16 },
  ]).fill(0x2a0e1a).stroke({ color: 0x1a0814, width: 2 });
  // Glowing eye slot
  body.rect(-3, -TILE_H / 2 - 12, 6, 2).fill(0xb84a3a);
  // Mitre / crown at the top
  body.poly([
    { x: -6, y: -TILE_H / 2 - 16 },
    { x: 6, y: -TILE_H / 2 - 16 },
    { x: 0, y: -TILE_H / 2 - 22 },
  ]).fill(0xc7b27a).stroke({ color: 0x1a0814, width: 1.5 });
  c.addChild(body);
  return c;
}

export function makeWormMotherSprite(): Container {
  const c = new Container();
  // Bulbous segmented worm body — wider than the Bishop, hunched lower.
  const body = new Graphics();
  // Lower segment — fat base.
  body
    .ellipse(0, TILE_H / 2 + 4, 14, 9)
    .fill(0x4a6a4a)
    .stroke({ color: 0x1a2a1a, width: 2 });
  // Mid segment.
  body
    .ellipse(0, TILE_H / 2 - 6, 12, 7)
    .fill(0x5a7a5a)
    .stroke({ color: 0x1a2a1a, width: 2 });
  // Upper segment + head.
  body
    .ellipse(0, -TILE_H / 2 - 2, 10, 10)
    .fill(0x6a8a6a)
    .stroke({ color: 0x1a2a1a, width: 2 });
  // Mandibles — two small triangles flanking the head.
  body
    .poly([
      { x: -8, y: -TILE_H / 2 - 6 },
      { x: -5, y: -TILE_H / 2 + 2 },
      { x: -10, y: -TILE_H / 2 + 1 },
    ])
    .fill(0xc8b878)
    .stroke({ color: 0x1a2a1a, width: 1.5 });
  body
    .poly([
      { x: 8, y: -TILE_H / 2 - 6 },
      { x: 5, y: -TILE_H / 2 + 2 },
      { x: 10, y: -TILE_H / 2 + 1 },
    ])
    .fill(0xc8b878)
    .stroke({ color: 0x1a2a1a, width: 1.5 });
  // Cluster of glowing eyes.
  body.circle(-3, -TILE_H / 2 - 4, 1.4).fill(0xfff19a);
  body.circle(0, -TILE_H / 2 - 6, 1.4).fill(0xfff19a);
  body.circle(3, -TILE_H / 2 - 4, 1.4).fill(0xfff19a);
  c.addChild(body);
  return c;
}

export function makePactBearerSprite(): Container {
  const c = new Container();
  const body = new Graphics();
  // Tall, broad cathedral knight — wider shoulders than the Bishop, holds a
  // halberd silhouette suggested by a vertical bar to the right.
  // Cape / cloak background.
  body
    .poly([
      { x: -10, y: TILE_H / 2 + 8 },
      { x: 10, y: TILE_H / 2 + 8 },
      { x: 7, y: -TILE_H / 2 + 4 },
      { x: -7, y: -TILE_H / 2 + 4 },
    ])
    .fill(0x3a1a1a)
    .stroke({ color: 0x1a0a0a, width: 2 });
  // Plate cuirass.
  body
    .rect(-6, -TILE_H / 2 + 6, 12, 16)
    .fill(0x6a5040)
    .stroke({ color: 0x1a1814, width: 1.5 });
  // Pact-flame sigil on the chest — small ember dot.
  body.circle(0, -TILE_H / 2 + 12, 2).fill(0xff8a3a);
  // Helm — broader than the Bishop's mitre; sealed visor.
  body
    .rect(-5, -TILE_H / 2 - 6, 10, 9)
    .fill(0x9a7a4a)
    .stroke({ color: 0x1a1814, width: 1.5 });
  // Visor slit.
  body.rect(-4, -TILE_H / 2 - 3, 8, 1.5).fill(0xff5530);
  // Halberd shaft (vertical) — silhouette only.
  body.rect(11, -TILE_H / 2 - 4, 1.5, TILE_H + 8).fill(0x2a1a0e);
  // Halberd head — angled blade.
  body
    .poly([
      { x: 10, y: -TILE_H / 2 - 4 },
      { x: 16, y: -TILE_H / 2 - 1 },
      { x: 11.5, y: -TILE_H / 2 + 4 },
    ])
    .fill(0xc8b878)
    .stroke({ color: 0x1a1814, width: 1.5 });
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
