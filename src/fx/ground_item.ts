// Ground item rendering. Each dropped Item gets a glowing diamond + a name
// label in the rarity color. Lives on the world layer; depth-sorted with the
// rest of the iso content.

import { Container, Graphics, Text, TextStyle, type Ticker } from 'pixi.js';
import { TILE_W, TILE_H, depthFor, tileToScreen } from '../engine/iso';
import type { TileCoord } from '../engine/iso';
import type { Item } from '../types/items';
import { RARITY_COLOR } from '../types/items';

const NAME_STYLE = new TextStyle({
  fontFamily: 'ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 'bold',
  fill: 0xffffff,
  stroke: { color: 0x1a1814, width: 3 },
});

export interface GroundItemView {
  readonly item: Item;
  readonly tile: TileCoord;
  readonly node: Container;
  destroy(): void;
}

export function spawnGroundItem(
  layer: Container,
  ticker: Ticker,
  item: Item,
  tile: TileCoord,
): GroundItemView {
  const node = new Container();
  node.label = `groundItem:${item.uid}`;
  const { sx, sy } = tileToScreen(tile.tx, tile.ty);
  node.position.set(sx, sy);
  // Items render slightly above the tile but below actors.
  node.zIndex = depthFor(tile.tx, tile.ty) + 0.4;

  // Glowing diamond.
  const color = RARITY_COLOR[item.rarity];
  const glow = new Graphics();
  drawDiamond(glow, color);

  const label = new Text({ text: item.name, style: { ...NAME_STYLE, fill: color } });
  label.anchor.set(0.5, 1);
  label.position.set(0, -TILE_H / 2 - 4);

  node.addChild(glow, label);
  layer.addChild(node);

  // Pulse animation: scale + alpha breathe so item stays visible against tile.
  let elapsed = 0;
  const pulse = (t: Ticker): void => {
    elapsed += t.deltaMS;
    const s = 0.92 + 0.08 * Math.sin(elapsed / 280);
    glow.scale.set(s, s);
    glow.alpha = 0.7 + 0.3 * Math.sin(elapsed / 280);
  };
  ticker.add(pulse);

  return {
    item,
    tile,
    node,
    destroy(): void {
      ticker.remove(pulse);
      node.destroy({ children: true });
    },
  };
}

function drawDiamond(g: Graphics, color: number): void {
  g.poly([
    { x: 0, y: -TILE_H / 2 + 4 },
    { x: TILE_W / 2 - 8, y: 0 },
    { x: 0, y: TILE_H / 2 - 4 },
    { x: -TILE_W / 2 + 8, y: 0 },
  ]);
  g.fill({ color, alpha: 0.55 });
  g.stroke({ color, width: 2, alpha: 0.95 });
}
