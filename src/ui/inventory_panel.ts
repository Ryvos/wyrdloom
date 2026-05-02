// Inventory panel — D2-coded 10x4 grid. Toggle with `I`.
//
// Click an inventory cell to equip that item (replaces the slot's current
// occupant — the previous goes back into the inventory).
// Right-click to drop the item back on the ground at the player's tile.

import { css, html, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { WyrdPanel, type PanelId } from './panel';
import {
  gameState,
  STATE_CHANGED_EVENT,
  INTENT_EQUIP_EVENT,
  INTENT_DROP_EVENT,
  type EquipIntent,
  type DropIntent,
} from './store';
import { INV_W, INV_H, type InvSlot } from '../systems/bag';
import { RARITY_COLOR, type Rarity } from '../types/items';

function rarityHex(r: Rarity): string {
  return '#' + RARITY_COLOR[r].toString(16).padStart(6, '0');
}

@customElement('wyrd-inventory')
export class WyrdInventory extends WyrdPanel {
  panelId: PanelId = 'inventory';
  panelTitle = 'Inventory';

  static override styles = [
    WyrdPanel.styles,
    css`
      .grid {
        display: grid;
        grid-template-columns: repeat(${unsafeCSS(INV_W)}, 36px);
        grid-template-rows: repeat(${unsafeCSS(INV_H)}, 36px);
        gap: 2px;
        background: #1a1816;
        padding: 4px;
        border: 1px solid #2c2a26;
      }
      .cell {
        width: 36px;
        height: 36px;
        background: #0e0d0c;
        border: 1px solid #2c2a26;
        position: relative;
        cursor: default;
      }
      .cell.occupied {
        cursor: pointer;
      }
      .cell.occupied:hover {
        outline: 1px solid #c7b27a;
        outline-offset: -1px;
      }
      .glyph {
        position: absolute;
        inset: 4px;
        border-radius: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: bold;
        color: #0a0a0c;
      }
      .footer {
        margin-top: 10px;
        font-size: 11px;
        opacity: 0.55;
        line-height: 1.6;
      }
    `,
  ];

  @state() private _tick = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(STATE_CHANGED_EVENT, this._onStateChanged);
  }
  override disconnectedCallback(): void {
    window.removeEventListener(STATE_CHANGED_EVENT, this._onStateChanged);
    super.disconnectedCallback();
  }

  // Bump local @state to force a re-render.
  private _onStateChanged = (): void => {
    this._tick++;
  };

  private _equip(uid: string): void {
    const detail: EquipIntent = { uid };
    window.dispatchEvent(new CustomEvent(INTENT_EQUIP_EVENT, { detail }));
  }
  private _drop(uid: string): void {
    const detail: DropIntent = { uid };
    window.dispatchEvent(new CustomEvent(INTENT_DROP_EVENT, { detail }));
  }

  private _glyphFor(slot: InvSlot): string {
    // 1-character glyph per slot until we vendor real icons.
    switch (slot.item.slot) {
      case 'weapon': return 'W';
      case 'head':   return 'H';
      case 'chest':  return 'C';
      case 'ring':   return 'R';
    }
  }

  protected override renderBody(): unknown {
    const inv = gameState.inventory;
    const slotMap = new Map<string, InvSlot>(); // "x,y" -> slot
    if (inv) {
      for (const s of inv.slots) {
        for (let dy = 0; dy < s.h; dy++) {
          for (let dx = 0; dx < s.w; dx++) {
            slotMap.set(`${s.x + dx},${s.y + dy}`, s);
          }
        }
      }
    }

    const cells: unknown[] = [];
    for (let y = 0; y < INV_H; y++) {
      for (let x = 0; x < INV_W; x++) {
        const slot = slotMap.get(`${x},${y}`);
        const occupied = !!slot;
        const isOrigin = slot && slot.x === x && slot.y === y;
        cells.push(html`
          <div
            class="cell ${occupied ? 'occupied' : ''}"
            data-testid="inv-cell-${x}-${y}"
            @click=${(): void => { if (slot) this._equip(slot.item.uid); }}
            @contextmenu=${(e: MouseEvent): void => {
              e.preventDefault();
              if (slot) this._drop(slot.item.uid);
            }}
            title=${slot ? slot.item.name : ''}
          >
            ${isOrigin && slot
              ? html`<div
                    class="glyph"
                    data-testid="inv-item-${slot.item.uid}"
                    style=${`background:${rarityHex(slot.item.rarity)}`}
                  >${this._glyphFor(slot)}</div>`
              : null}
          </div>
        `);
      }
    }

    return html`
      <div class="grid" data-testid="inv-grid">${cells}</div>
      <div class="footer">
        Click an item to equip · right-click to drop · I or Esc to close
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wyrd-inventory': WyrdInventory;
  }
}
