// Imbuer panel — Whitestone NPC service. Two recipes:
//   1. Imbue: pick 3 magic same-slot items → 1 rare
//   2. Socket: pick a gem + a target item with an empty socket → place gem
//
// The panel is read-only over `gameState`; user clicks build a local selection
// and emit ImbueIntent / SocketIntent events that main.ts handles.

import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { WyrdPanel, type PanelId } from './panel';
import {
  gameState,
  STATE_CHANGED_EVENT,
  INTENT_IMBUE_EVENT,
  INTENT_SOCKET_EVENT,
  type ImbueIntent,
  type SocketIntent,
} from './store';
import { RARITY_COLOR, type Item, type Rarity, type GemKind } from '../types/items';

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

type Tab = 'imbue' | 'socket';

@customElement('wyrd-imbuer')
export class WyrdImbuer extends WyrdPanel {
  panelId: PanelId = 'imbuer';
  panelTitle = 'The Imbuer';

  static override styles = [
    WyrdPanel.styles,
    css`
      :host {
        min-width: 480px;
      }
      .tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 10px;
      }
      .tab {
        background: #1a1816;
        border: 1px solid #2c2a26;
        color: #c8c2af;
        padding: 4px 12px;
        font-family: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .tab.active {
        background: #2c2a26;
        border-color: #4a463d;
        color: #d8d2bf;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .col {
        flex: 1;
        min-width: 0;
      }
      .col h4 {
        margin: 0 0 6px 0;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        opacity: 0.7;
      }
      .list {
        max-height: 240px;
        overflow-y: auto;
        border: 1px solid #2c2a26;
        background: #0e0d0c;
        padding: 4px;
      }
      .row-item {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        padding: 3px 6px;
        cursor: pointer;
        border-radius: 2px;
      }
      .row-item:hover {
        background: #1a1816;
      }
      .row-item.selected {
        outline: 1px solid #c7b27a;
        background: #1a1816;
      }
      .row-item .meta {
        opacity: 0.55;
        font-size: 10px;
        margin-left: 6px;
      }
      .actions {
        margin-top: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .btn {
        background: #2c2a26;
        color: #d8d2bf;
        border: 1px solid #4a463d;
        border-radius: 3px;
        padding: 6px 14px;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
      }
      .btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .btn:hover:not(:disabled) {
        background: #3a3833;
      }
      .status {
        font-size: 11px;
        opacity: 0.65;
      }
      .status.error {
        color: #c44a2a;
        opacity: 1;
      }
      .empty {
        opacity: 0.45;
        font-size: 11px;
        padding: 10px;
        text-align: center;
      }
      .pip {
        margin: 0 1px;
      }
    `,
  ];

  @state() private _tab: Tab = 'imbue';
  @state() private _selected: string[] = []; // imbue: 3 magic uids
  @state() private _gemUid: string | null = null;
  @state() private _targetUid: string | null = null;
  @state() private _status = '';
  @state() private _statusError = false;
  @state() private _tick = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(STATE_CHANGED_EVENT, this._onState);
  }
  override disconnectedCallback(): void {
    window.removeEventListener(STATE_CHANGED_EVENT, this._onState);
    super.disconnectedCallback();
  }
  private _onState = (): void => {
    this._tick++;
    // Selections may now reference removed uids (after consumption); prune.
    this._selected = this._selected.filter((u) => this._invItem(u));
    if (this._gemUid && !this._invItem(this._gemUid)) this._gemUid = null;
    if (this._targetUid && !this._anyItem(this._targetUid)) this._targetUid = null;
  };

  private _invItem(uid: string): Item | undefined {
    const inv = gameState.inventory;
    if (!inv) return undefined;
    return inv.slots.find((s) => s.item.uid === uid)?.item;
  }
  private _anyItem(uid: string): Item | undefined {
    const fromInv = this._invItem(uid);
    if (fromInv) return fromInv;
    for (const it of Object.values(gameState.equipment)) {
      if (it && it.uid === uid) return it;
    }
    return undefined;
  }

  private _toggleSelect(uid: string): void {
    const ix = this._selected.indexOf(uid);
    if (ix >= 0) {
      this._selected = this._selected.filter((u) => u !== uid);
    } else if (this._selected.length < 3) {
      // Enforce same-slot rule client-side too — main.ts revalidates.
      const first = this._selected[0];
      if (first) {
        const a = this._invItem(first);
        const b = this._invItem(uid);
        if (a && b && a.slot !== b.slot) {
          this._setStatus('Mixed slots — pick three of the same slot.', true);
          return;
        }
      }
      this._selected = [...this._selected, uid];
    }
    this._setStatus('', false);
  }

  private _setStatus(msg: string, isError: boolean): void {
    this._status = msg;
    this._statusError = isError;
  }

  private _doImbue(): void {
    if (this._selected.length !== 3) return;
    const detail: ImbueIntent = { uids: [...this._selected] };
    window.dispatchEvent(new CustomEvent(INTENT_IMBUE_EVENT, { detail }));
    this._selected = [];
    this._setStatus('Imbued.', false);
  }

  private _doSocket(): void {
    if (!this._gemUid || !this._targetUid) return;
    const detail: SocketIntent = { gemUid: this._gemUid, targetUid: this._targetUid };
    window.dispatchEvent(new CustomEvent(INTENT_SOCKET_EVENT, { detail }));
    this._gemUid = null;
    this._targetUid = null;
    this._setStatus('Socketed.', false);
  }

  private _selectTab(t: Tab): void {
    this._tab = t;
    this._selected = [];
    this._gemUid = null;
    this._targetUid = null;
    this._setStatus('', false);
  }

  private _bagItems(): Item[] {
    const inv = gameState.inventory;
    if (!inv) return [];
    // Inventory slots can repeat item refs across the cells they occupy when
    // sized; dedupe by uid.
    const seen = new Set<string>();
    const out: Item[] = [];
    for (const s of inv.slots) {
      if (seen.has(s.item.uid)) continue;
      seen.add(s.item.uid);
      out.push(s.item);
    }
    return out;
  }

  protected override renderBody(): unknown {
    return html`
      <div class="tabs">
        <button
          class=${`tab ${this._tab === 'imbue' ? 'active' : ''}`}
          data-testid="imbuer-tab-imbue"
          @click=${(): void => this._selectTab('imbue')}
        >Imbue (3 → 1)</button>
        <button
          class=${`tab ${this._tab === 'socket' ? 'active' : ''}`}
          data-testid="imbuer-tab-socket"
          @click=${(): void => this._selectTab('socket')}
        >Socket Gem</button>
      </div>
      ${this._tab === 'imbue' ? this._renderImbue() : this._renderSocket()}
      ${this._status
        ? html`<div class="status ${this._statusError ? 'error' : ''}" data-testid="imbuer-status">${this._status}</div>`
        : null}
    `;
  }

  private _renderImbue(): unknown {
    const magicItems = this._bagItems().filter(
      (it) => it.rarity === 'magic' && !it.gem,
    );
    return html`
      <div class="col">
        <h4>Magic items in your bag (pick 3 of the same slot)</h4>
        <div class="list" data-testid="imbuer-magic-list">
          ${magicItems.length === 0
            ? html`<div class="empty">No magic items.</div>`
            : magicItems.map(
                (it) => html`
                  <div
                    class=${`row-item ${this._selected.includes(it.uid) ? 'selected' : ''}`}
                    data-testid="imbuer-row-${it.uid}"
                    @click=${(): void => this._toggleSelect(it.uid)}
                  >
                    <span style=${`color:${rarityHex(it.rarity)}`}>${it.name}</span>
                    <span class="meta">${it.slot} · ilvl ${it.ilvl}</span>
                  </div>
                `,
              )}
        </div>
      </div>
      <div class="actions">
        <span class="status">${this._selected.length} / 3 selected</span>
        <button
          class="btn"
          data-testid="imbuer-imbue-btn"
          ?disabled=${this._selected.length !== 3}
          @click=${(): void => this._doImbue()}
        >Imbue</button>
      </div>
    `;
  }

  private _renderSocket(): unknown {
    const bag = this._bagItems();
    const gems = bag.filter((it) => !!it.gem);
    // Targets: any item (bag or equipped) with at least one empty socket.
    const targets: Item[] = [];
    for (const it of bag) {
      if (it.gem) continue;
      if (it.sockets && it.sockets.some((g) => g === null)) targets.push(it);
    }
    for (const it of Object.values(gameState.equipment)) {
      if (it && it.sockets && it.sockets.some((g) => g === null)) targets.push(it);
    }

    return html`
      <div class="row">
        <div class="col">
          <h4>Gems</h4>
          <div class="list" data-testid="imbuer-gem-list">
            ${gems.length === 0
              ? html`<div class="empty">No loose gems.</div>`
              : gems.map(
                  (it) => html`
                    <div
                      class=${`row-item ${this._gemUid === it.uid ? 'selected' : ''}`}
                      data-testid="imbuer-gem-${it.uid}"
                      @click=${(): void => {
                        this._gemUid = this._gemUid === it.uid ? null : it.uid;
                      }}
                    >
                      <span style=${`color:${it.gem ? GEM_KIND_COLOR[it.gem.kind] : '#c8c2af'}`}>${it.name}</span>
                      <span class="meta">${it.gem?.quality}</span>
                    </div>
                  `,
                )}
          </div>
        </div>
        <div class="col">
          <h4>Items with empty sockets</h4>
          <div class="list" data-testid="imbuer-target-list">
            ${targets.length === 0
              ? html`<div class="empty">No items with open sockets.</div>`
              : targets.map(
                  (it) => html`
                    <div
                      class=${`row-item ${this._targetUid === it.uid ? 'selected' : ''}`}
                      data-testid="imbuer-target-${it.uid}"
                      @click=${(): void => {
                        this._targetUid = this._targetUid === it.uid ? null : it.uid;
                      }}
                    >
                      <span style=${`color:${rarityHex(it.rarity)}`}>${it.name}</span>
                      <span class="meta">
                        ${(it.sockets ?? []).map((g) =>
                          g
                            ? html`<span class="pip" style=${`color:${GEM_KIND_COLOR[g.kind]}`}>&#x25C6;</span>`
                            : html`<span class="pip" style="opacity:0.45;">&#x25CB;</span>`,
                        )}
                      </span>
                    </div>
                  `,
                )}
          </div>
        </div>
      </div>
      <div class="actions">
        <span class="status">
          ${this._gemUid && this._targetUid ? 'Ready to socket.' : 'Pick a gem and a target.'}
        </span>
        <button
          class="btn"
          data-testid="imbuer-socket-btn"
          ?disabled=${!this._gemUid || !this._targetUid}
          @click=${(): void => this._doSocket()}
        >Socket</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wyrd-imbuer': WyrdImbuer;
  }
}
