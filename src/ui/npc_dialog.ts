// NPC dialog panel — shown when the player talks to an NPC. The Quest-board
// in Whitestone shows a list of active main quests; placeholder NPCs (Smith,
// Imbuer, Stash) show their teaser line. Toggle via npc-dialog-show event.

import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { gameState } from './store';
import { allQuestDefs } from '../systems/quests';
import { NPC_DIALOG, type NpcKind } from '../actors/Npc';

export const NPC_DIALOG_OPEN_EVENT = 'wyrdloom:npc-dialog-open';
export const NPC_DIALOG_CLOSE_EVENT = 'wyrdloom:npc-dialog-close';

export interface NpcDialogOpenDetail {
  readonly kind: NpcKind;
  readonly npcName: string;
}

@customElement('wyrd-npcdialog')
export class WyrdNpcDialog extends LitElement {
  static override styles = css`
    :host {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      background: rgba(10, 10, 12, 0.94);
      border: 1px solid #4a463d;
      border-radius: 6px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
      color: #d8d2bf;
      font-family: system-ui, sans-serif;
      padding: 16px 20px;
      min-width: 380px;
      display: none;
    }
    :host([open]) {
      display: block;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #4a463d;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .name {
      font-size: 14px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      opacity: 0.85;
    }
    .close {
      background: transparent;
      color: #c8c2af;
      border: 1px solid #4a463d;
      border-radius: 3px;
      cursor: pointer;
      width: 22px;
      height: 22px;
      line-height: 18px;
      padding: 0;
      font-family: inherit;
    }
    .close:hover {
      background: #2c2a26;
    }
    .greeting {
      font-style: italic;
      opacity: 0.85;
      margin-bottom: 10px;
    }
    .teaser {
      font-size: 12px;
      opacity: 0.7;
      margin-bottom: 12px;
    }
    .quests {
      border-top: 1px solid #2c2a26;
      padding-top: 10px;
      margin-top: 6px;
    }
    .quest {
      padding: 6px 0;
      border-bottom: 1px solid #2c2a26;
    }
    .quest:last-of-type {
      border-bottom: none;
    }
    .qtitle {
      font-weight: bold;
      font-size: 13px;
    }
    .qtitle.completed {
      text-decoration: line-through;
      opacity: 0.55;
    }
    .qsummary {
      font-size: 11px;
      opacity: 0.75;
      margin-top: 2px;
      line-height: 1.4;
    }
    .qmeta {
      font-size: 10px;
      opacity: 0.55;
      margin-top: 3px;
    }
  `;

  @state() private _kind: NpcKind | null = null;
  @state() private _name = '';

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(NPC_DIALOG_OPEN_EVENT, this._onOpen);
    window.addEventListener(NPC_DIALOG_CLOSE_EVENT, this._onClose);
  }
  override disconnectedCallback(): void {
    window.removeEventListener(NPC_DIALOG_OPEN_EVENT, this._onOpen);
    window.removeEventListener(NPC_DIALOG_CLOSE_EVENT, this._onClose);
    super.disconnectedCallback();
  }

  private _onOpen = (e: Event): void => {
    const detail = (e as CustomEvent<NpcDialogOpenDetail>).detail;
    if (!detail) return;
    this._kind = detail.kind;
    this._name = detail.npcName;
    this.setAttribute('open', '');
  };
  private _onClose = (): void => {
    this.removeAttribute('open');
    this._kind = null;
  };

  private _close(): void {
    window.dispatchEvent(new CustomEvent(NPC_DIALOG_CLOSE_EVENT));
  }

  override render(): unknown {
    if (!this._kind) return null;
    const dialog = NPC_DIALOG[this._kind];
    return html`
      <div class="header">
        <span class="name" data-testid="npc-name">${this._name}</span>
        <button class="close" aria-label="Close" @click=${(): void => this._close()}>×</button>
      </div>
      <div class="greeting">${dialog.greeting}</div>
      <div class="teaser">${dialog.teaser}</div>
      ${this._kind === 'questboard' ? this._renderQuests() : null}
    `;
  }

  private _renderQuests(): unknown {
    const defs = allQuestDefs();
    const progress = gameState.quests?.progress ?? {};
    const visible = defs.filter((d) => {
      const s = progress[d.id]?.status;
      return s === 'active' || s === 'completed';
    });
    if (visible.length === 0) {
      return html`<div class="quests"><div class="qmeta">No active quests yet — descend into the catacombs to begin.</div></div>`;
    }
    return html`
      <div class="quests" data-testid="qb-quests">
        ${visible.map((d) => {
          const p = progress[d.id];
          const completed = p?.status === 'completed';
          return html`
            <div class="quest" data-testid="qb-quest-${d.id}">
              <div class="qtitle ${completed ? 'completed' : ''}">${d.title}</div>
              <div class="qsummary">${d.summary}</div>
              <div class="qmeta">
                ${completed
                  ? `Reward earned: ${d.reward}`
                  : `${p?.current ?? 0}/${d.objective.count} · Reward: ${d.reward}`}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wyrd-npcdialog': WyrdNpcDialog;
  }
}
