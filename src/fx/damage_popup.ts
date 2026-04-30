// Floating damage number. Pixi Text that rises 32px and fades over 800ms.
// Owns its own lifecycle — caller spawns it; it removes itself when done.

import { Container, Text, TextStyle } from 'pixi.js';
import type { Ticker } from 'pixi.js';

const LIFETIME_MS = 800;
const RISE_PX = 32;

const STYLE_HIT = new TextStyle({
  fontFamily: 'ui-monospace, monospace',
  fontSize: 14,
  fontWeight: 'bold',
  fill: 0xc7b27a,
  stroke: { color: 0x1a1814, width: 3 },
});

const STYLE_KILL = new TextStyle({
  fontFamily: 'ui-monospace, monospace',
  fontSize: 16,
  fontWeight: 'bold',
  fill: 0xb84a3a,
  stroke: { color: 0x1a1814, width: 3 },
});

export function spawnDamagePopup(
  layer: Container,
  worldX: number,
  worldY: number,
  amount: number,
  killed: boolean,
  ticker: Ticker,
): void {
  const text = new Text({
    text: String(amount),
    style: killed ? STYLE_KILL : STYLE_HIT,
  });
  text.anchor.set(0.5, 1);
  text.position.set(worldX, worldY - 8);
  text.zIndex = 99999; // always on top of world content
  layer.addChild(text);

  let elapsed = 0;
  const onTick = (t: Ticker): void => {
    elapsed += t.deltaMS;
    const k = Math.min(1, elapsed / LIFETIME_MS);
    text.position.y = worldY - 8 - RISE_PX * k;
    text.alpha = 1 - k;
    if (k >= 1) {
      ticker.remove(onTick);
      text.destroy();
    }
  };
  ticker.add(onTick);
}
