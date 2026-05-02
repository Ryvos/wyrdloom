// Skill hotbar — 4 slots, keys 1-4 trigger them. Click an empty slot to bind,
// right-click a bound slot to clear. Always visible at the bottom of the HUD.
//
// Hotbar bindings live on `gameState.hotbar` so panels and main.ts can share
// the source of truth. Triggering a skill dispatches `wyrdloom:skill-trigger`
// — the game loop is the consumer (v0.4.0 only listens for `melee`).

import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  gameState,
  STATE_CHANGED_EVENT,
  type HotbarBinding,
} from './store';
import { dispatchPanelToggle } from './panel';

export const SKILL_TRIGGER_EVENT = 'wyrdloom:skill-trigger';

export interface SkillTriggerDetail {
  readonly slot: number; // 0..3
  readonly skillId: string;
}

@customElement('wyrd-hotbar')
export class WyrdHotbar extends LitElement {
  static override styles = css`
    :host {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 6px;
      pointer-events: auto;
      background: rgba(10, 10, 12, 0.85);
      border: 1px solid #4a463d;
      border-radius: 4px;
      padding: 4px;
    }
    .slot {
      width: 44px;
      height: 44px;
      background: #0e0d0c;
      border: 1px solid #2c2a26;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      color: #d8d2bf;
      font-size: 22px;
    }
    .slot:hover {
      outline: 1px solid #c7b27a;
      outline-offset: -1px;
    }
    .key {
      position: absolute;
      bottom: 2px;
      right: 4px;
      font-size: 10px;
      opacity: 0.55;
      font-family: ui-monospace, monospace;
    }
    .empty {
      opacity: 0.45;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
  `;

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

  private _onSlotClick(index: number): void {
    // Stash the target slot FIRST — the bind panel's toggle handler reads it
    // synchronously when the open event fires. Setting after would race.
    pendingBindSlot.value = index;
    dispatchPanelToggle({ id: 'bind', open: true });
  }

  private _onSlotRightClick(e: MouseEvent, index: number): void {
    e.preventDefault();
    setHotbarBinding(index, null);
  }

  override render(): unknown {
    const slots: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      const b = gameState.hotbar[i];
      slots.push(html`
        <div
          class="slot"
          data-testid="hotbar-${i}"
          @click=${(): void => this._onSlotClick(i)}
          @contextmenu=${(e: MouseEvent): void => this._onSlotRightClick(e, i)}
          title=${b ? `${b.label} (key ${i + 1})` : `Empty — click to bind (key ${i + 1})`}
        >
          ${b
            ? html`<span data-testid="hotbar-${i}-icon">${b.label}</span>`
            : html`<span class="empty">—</span>`}
          <span class="key">${i + 1}</span>
        </div>
      `);
    }
    return html`${slots}`;
  }
}

// Module-scope shared state for the bind flow. The hotbar tells the bind panel
// which slot the player tapped, then the panel writes the binding back here.
export const pendingBindSlot: { value: number | null } = { value: null };

// Mutate one slot of the hotbar. Re-emits state-changed so panels refresh.
export function setHotbarBinding(index: number, binding: HotbarBinding | null): void {
  const next = [...gameState.hotbar];
  next[index] = binding;
  gameState.hotbar = next;
  window.dispatchEvent(new CustomEvent(STATE_CHANGED_EVENT));
}

declare global {
  interface HTMLElementTagNameMap {
    'wyrd-hotbar': WyrdHotbar;
  }
}
