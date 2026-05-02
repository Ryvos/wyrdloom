// Echo Portal panel — Whitestone Wyrdkeeper service. Lists sigils currently
// in the player's bag; clicking one consumes it and loads the Echo at that
// sigil's tier (handled by main.ts via INTENT_ECHO_ENTER_EVENT).
//
// Sigils are bag-only Items with `item.sigil = { tier }`. Pact-Bearer kills
// guarantee one; regular bosses get a small chance.

import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { WyrdPanel, type PanelId } from './panel';
import {
  gameState,
  STATE_CHANGED_EVENT,
  INTENT_ECHO_ENTER_EVENT,
  type EchoEnterIntent,
} from './store';
import type { Item } from '../types/items';

@customElement('wyrd-echo-portal')
export class WyrdEchoPortal extends WyrdPanel {
  panelId: PanelId = 'echo-portal';
  panelTitle = 'The Echo';

  static override styles = [
    WyrdPanel.styles,
    css`
      :host {
        min-width: 380px;
      }
      .lead {
        font-size: 12px;
        opacity: 0.75;
        margin-bottom: 12px;
        font-style: italic;
        line-height: 1.5;
      }
      .list {
        max-height: 280px;
        overflow-y: auto;
        border: 1px solid #2c2a26;
        background: #0e0d0c;
        padding: 4px;
      }
      .row {
        display: flex;
        justify-content: space-between;
        padding: 6px 8px;
        cursor: pointer;
        border-radius: 2px;
      }
      .row:hover {
        background: #1a1816;
      }
      .row .meta {
        opacity: 0.55;
        font-size: 10px;
      }
      .empty {
        opacity: 0.5;
        font-size: 12px;
        padding: 14px;
        text-align: center;
      }
      .footer {
        margin-top: 12px;
        font-size: 11px;
        opacity: 0.55;
      }
    `,
  ];

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
  };

  private _bagSigils(): Item[] {
    const inv = gameState.inventory;
    if (!inv) return [];
    const seen = new Set<string>();
    const out: Item[] = [];
    for (const s of inv.slots) {
      if (seen.has(s.item.uid)) continue;
      seen.add(s.item.uid);
      if (s.item.sigil) out.push(s.item);
    }
    // Sort by tier descending — most powerful run options shown first.
    out.sort((a, b) => (b.sigil?.tier ?? 0) - (a.sigil?.tier ?? 0));
    return out;
  }

  private _enter(uid: string): void {
    const detail: EchoEnterIntent = { sigilUid: uid };
    window.dispatchEvent(new CustomEvent(INTENT_ECHO_ENTER_EVENT, { detail }));
  }

  protected override renderBody(): unknown {
    const sigils = this._bagSigils();
    return html`
      <div class="lead">
        Tier scales the Echo's monsters and what falls from them. Floor 5 is
        the Pinnacle.
      </div>
      <div class="list" data-testid="echo-sigil-list">
        ${sigils.length === 0
          ? html`<div class="empty">No sigils carried. The Pact-Bearer drops one.</div>`
          : sigils.map(
              (it) => html`
                <div
                  class="row"
                  data-testid="echo-sigil-${it.uid}"
                  @click=${(): void => this._enter(it.uid)}
                >
                  <span style="color:#c8a64a;">${it.name}</span>
                  <span class="meta">tier ${it.sigil?.tier} · click to enter</span>
                </div>
              `,
            )}
      </div>
      <div class="footer">Sigils consume on entry. Esc to close.</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wyrd-echo-portal': WyrdEchoPortal;
  }
}
