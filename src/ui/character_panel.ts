// Character sheet — paper-doll for the 4 equipment slots + derived stats.
// Toggle with `C`. Click an equipped item to unequip (item returns to bag,
// or drops on the floor if the bag is full).

import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { WyrdPanel, type PanelId } from './panel';
import {
  gameState,
  STATE_CHANGED_EVENT,
  INTENT_UNEQUIP_EVENT,
  type UnequipIntent,
} from './store';
import { RARITY_COLOR, type GemKind, type Item, type Rarity, type Slot } from '../types/items';

function rarityHex(r: Rarity): string {
  return '#' + RARITY_COLOR[r].toString(16).padStart(6, '0');
}

const GEM_KIND_COLOR: Record<GemKind, string> = {
  ruby: '#c44a2a',
  sapphire: '#3a6ec9',
  emerald: '#3aa75a',
  topaz: '#c8a64a',
  diamond: '#dceaf0',
};

@customElement('wyrd-character')
export class WyrdCharacter extends WyrdPanel {
  panelId: PanelId = 'character';
  panelTitle = 'Character';

  static override styles = [
    WyrdPanel.styles,
    css`
      .layout {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 16px;
      }
      .doll {
        display: grid;
        grid-template-areas:
          '.    head .'
          'ring chest ring2'
          '.    weapon .';
        grid-template-columns: 56px 56px 56px;
        grid-template-rows: 56px 56px 56px;
        gap: 6px;
      }
      .slot {
        background: #0e0d0c;
        border: 1px solid #2c2a26;
        border-radius: 3px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        text-transform: uppercase;
        opacity: 0.65;
        cursor: default;
        position: relative;
      }
      .slot.head { grid-area: head; }
      .slot.chest { grid-area: chest; }
      .slot.weapon { grid-area: weapon; }
      .slot.ring { grid-area: ring; }
      .slot.equipped {
        cursor: pointer;
        opacity: 1;
      }
      .slot.equipped:hover {
        outline: 1px solid #c7b27a;
      }
      .slot .glyph {
        width: 32px;
        height: 32px;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #0a0a0c;
        font-weight: bold;
        font-size: 18px;
      }
      .slot .name {
        margin-top: 4px;
        font-size: 9px;
        opacity: 0.85;
        text-align: center;
        line-height: 1.1;
        max-width: 50px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .slot .sockets {
        margin-top: 2px;
        font-size: 9px;
        line-height: 1;
        letter-spacing: 1px;
      }
      .slot .sockets .empty {
        opacity: 0.45;
      }
      .stats {
        font-size: 13px;
        line-height: 1.7;
      }
      .stats .row {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px dashed #2c2a26;
      }
      .stats .label {
        opacity: 0.7;
      }
      .stats .delta {
        opacity: 0.55;
        font-size: 11px;
        margin-left: 6px;
      }
      .footer {
        margin-top: 10px;
        font-size: 11px;
        opacity: 0.55;
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
  private _onStateChanged = (): void => {
    this._tick++;
  };

  private _unequip(slot: Slot): void {
    const detail: UnequipIntent = { slot };
    window.dispatchEvent(new CustomEvent(INTENT_UNEQUIP_EVENT, { detail }));
  }

  private _glyph(slot: Slot): string {
    switch (slot) {
      case 'weapon': return 'W';
      case 'head':   return 'H';
      case 'chest':  return 'C';
      case 'ring':   return 'R';
    }
  }

  private _renderSlot(slot: Slot, item: Item | undefined): unknown {
    if (!item) {
      return html`
        <div class="slot ${slot}" data-testid="paperdoll-${slot}">
          <span>${slot}</span>
        </div>
      `;
    }
    const sockets = item.sockets ?? [];
    return html`
      <div
        class="slot ${slot} equipped"
        data-testid="paperdoll-${slot}"
        title="Click to unequip"
        @click=${(): void => this._unequip(slot)}
      >
        <div class="glyph" style=${`background:${rarityHex(item.rarity)}`}>
          ${this._glyph(slot)}
        </div>
        <div class="name" style=${`color:${rarityHex(item.rarity)}`}>${item.name}</div>
        ${sockets.length > 0
          ? html`<div class="sockets" data-testid="paperdoll-sockets-${slot}">
              ${sockets.map((g) =>
                g
                  ? html`<span style=${`color:${GEM_KIND_COLOR[g.kind]}`} title=${g.name}>&#x25C6;</span>`
                  : html`<span class="empty">&#x25CB;</span>`,
              )}
            </div>`
          : null}
      </div>
    `;
  }

  protected override renderBody(): unknown {
    const eq = gameState.equipment;
    const d = gameState.derived;
    const baseAtkDelta = d.atk - gameState.baseAtk;
    const baseHpDelta = d.maxHp - gameState.baseMaxHp;

    return html`
      <div class="layout">
        <div class="doll" data-testid="paperdoll">
          ${this._renderSlot('head', eq.head)}
          ${this._renderSlot('chest', eq.chest)}
          ${this._renderSlot('weapon', eq.weapon)}
          ${this._renderSlot('ring', eq.ring)}
        </div>
        <div class="stats" data-testid="char-stats">
          <div class="row">
            <span class="label">Attack</span>
            <span>
              ${d.atk}
              ${baseAtkDelta !== 0
                ? html`<span class="delta">(base ${gameState.baseAtk} +${baseAtkDelta})</span>`
                : null}
            </span>
          </div>
          <div class="row">
            <span class="label">Max HP</span>
            <span>
              ${d.maxHp}
              ${baseHpDelta !== 0
                ? html`<span class="delta">(base ${gameState.baseMaxHp} +${baseHpDelta})</span>`
                : null}
            </span>
          </div>
          <div class="row">
            <span class="label">Armor</span>
            <span>${d.armor}</span>
          </div>
        </div>
      </div>
      <div class="footer">Click an equipped item to unequip · C or Esc to close</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wyrd-character': WyrdCharacter;
  }
}
