// Quest tracker — DOM panel showing active + completed quests. Toggle with
// `Q`. Renders progress bars per active quest. Compact tracker badge in the
// HUD shows the current main-quest objective at a glance even when the
// panel is closed.

import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { gameState, STATE_CHANGED_EVENT } from './store';
import { allQuestDefs } from '../systems/quests';
import type { QuestDef, QuestStatus } from '../types/quests';

export const QUEST_TOGGLE_EVENT = 'wyrdloom:quest-toggle';

@customElement('wyrd-questtracker')
export class WyrdQuestTracker extends LitElement {
  static override styles = css`
    :host {
      position: absolute;
      top: 12px;
      right: 220px;
      width: 260px;
      pointer-events: auto;
      font-family: system-ui, sans-serif;
      color: #d8d2bf;
      background: rgba(10, 10, 12, 0.85);
      border: 1px solid #4a463d;
      border-radius: 4px;
      padding: 8px 10px;
      font-size: 12px;
    }
    :host([open]) {
      width: 320px;
    }
    .header {
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      opacity: 0.65;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
    }
    .quest {
      border-top: 1px solid #2c2a26;
      padding: 6px 0;
    }
    .quest:first-of-type {
      border-top: none;
      padding-top: 0;
    }
    .title {
      font-weight: bold;
      margin-bottom: 2px;
    }
    .title.completed {
      text-decoration: line-through;
      opacity: 0.5;
    }
    .summary {
      font-size: 11px;
      opacity: 0.7;
      margin-bottom: 4px;
      line-height: 1.4;
    }
    .progress {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      opacity: 0.75;
    }
    .bar {
      flex: 1;
      height: 4px;
      background: #1a1814;
      border: 1px solid #2c2a26;
      overflow: hidden;
    }
    .fill {
      height: 100%;
      background: #6b8a64;
    }
    .reward {
      font-size: 10px;
      opacity: 0.55;
      margin-top: 2px;
    }
    .empty {
      opacity: 0.55;
      font-size: 11px;
    }
  `;

  @state() private _expanded = false;
  @state() private _tick = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(STATE_CHANGED_EVENT, this._onStateChanged);
    window.addEventListener(QUEST_TOGGLE_EVENT, this._onToggle);
  }
  override disconnectedCallback(): void {
    window.removeEventListener(STATE_CHANGED_EVENT, this._onStateChanged);
    window.removeEventListener(QUEST_TOGGLE_EVENT, this._onToggle);
    super.disconnectedCallback();
  }
  private _onStateChanged = (): void => {
    this._tick++;
  };
  private _onToggle = (): void => {
    this._expanded = !this._expanded;
    if (this._expanded) this.setAttribute('open', '');
    else this.removeAttribute('open');
  };

  private _statusOf(id: string): QuestStatus {
    return gameState.quests?.progress[id]?.status ?? 'inactive';
  }
  private _currentOf(id: string): number {
    return gameState.quests?.progress[id]?.current ?? 0;
  }

  override render(): unknown {
    const defs = allQuestDefs();
    const active = defs.filter((d) => this._statusOf(d.id) === 'active');
    const completed = defs.filter((d) => this._statusOf(d.id) === 'completed');

    if (!this._expanded) {
      // Compact tracker — show the lowest-order active main quest only.
      const tracking = active.filter((d) => d.main).sort((a, b) => a.order - b.order)[0];
      return html`
        <div class="header"><span>Quest</span><span>Q</span></div>
        ${tracking ? this._renderQuest(tracking) : html`<div class="empty">No active quests.</div>`}
      `;
    }

    return html`
      <div class="header"><span>Quests · Active</span><span>Q</span></div>
      ${active.length === 0
        ? html`<div class="empty">No active quests.</div>`
        : active.map((d) => this._renderQuest(d))}
      ${completed.length > 0
        ? html`
            <div class="header" style="margin-top:10px;"><span>Completed</span></div>
            ${completed.map((d) => this._renderQuest(d))}
          `
        : null}
    `;
  }

  private _renderQuest(def: QuestDef): unknown {
    const status = this._statusOf(def.id);
    const cur = this._currentOf(def.id);
    const total = def.objective.count;
    const pct = total > 0 ? Math.min(100, (cur / total) * 100) : 0;
    return html`
      <div class="quest" data-testid="quest-${def.id}">
        <div class="title ${status === 'completed' ? 'completed' : ''}">${def.title}</div>
        <div class="summary">${def.summary}</div>
        <div class="progress">
          <span>${cur}/${total}</span>
          <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
        </div>
        <div class="reward">Reward: ${def.reward}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wyrd-questtracker': WyrdQuestTracker;
  }
}
