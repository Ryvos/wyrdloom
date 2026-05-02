// Shared base for Lit-rendered HUD panels (inventory, character sheet).
//
// Per spec §6.1 the HUD is DOM, never in-canvas. Per §6.2 Lit is the
// recommended choice for menu panels. Each panel is a Web Component that
// lives inside #hud, with `pointer-events: auto` so clicks land here instead
// of falling through to the Pixi canvas. The panel host itself listens for
// `wyrdloom:panel-toggle` CustomEvents on the window so main.ts can flip
// visibility without coupling to Lit internals.

import { LitElement, css, html, type CSSResultGroup, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';

export type PanelId = 'inventory' | 'character' | 'bind' | 'imbuer' | 'echo-portal';

export interface PanelToggleDetail {
  readonly id: PanelId;
  readonly open?: boolean; // omit = toggle, true = open, false = close
}

export const PANEL_TOGGLE_EVENT = 'wyrdloom:panel-toggle';

// Convenience for callers (main.ts keyboard handler).
export function dispatchPanelToggle(detail: PanelToggleDetail): void {
  window.dispatchEvent(new CustomEvent(PANEL_TOGGLE_EVENT, { detail }));
}

// Subclasses set `panelId` and implement `renderBody()`.
export abstract class WyrdPanel extends LitElement {
  static override styles: CSSResultGroup = css`
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
      min-width: 360px;
      display: none;
    }
    :host([open]) {
      display: block;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #4a463d;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .panel-title {
      font-size: 14px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      opacity: 0.85;
    }
    .panel-close {
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
    .panel-close:hover {
      background: #2c2a26;
    }
  `;

  abstract panelId: PanelId;
  abstract panelTitle: string;

  @property({ type: Boolean, reflect: true }) open = false;

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(PANEL_TOGGLE_EVENT, this._onToggle);
  }
  override disconnectedCallback(): void {
    window.removeEventListener(PANEL_TOGGLE_EVENT, this._onToggle);
    super.disconnectedCallback();
  }

  // Bound arrow so removeEventListener finds the same reference.
  private _onToggle = (e: Event): void => {
    const detail = (e as CustomEvent<PanelToggleDetail>).detail;
    if (!detail || detail.id !== this.panelId) return;
    if (typeof detail.open === 'boolean') {
      this.open = detail.open;
    } else {
      this.open = !this.open;
    }
  };

  protected close(): void {
    this.open = false;
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('open') && this.open) {
      // Nothing to focus yet (no inputs). Hook here when bind-skill arrives.
    }
  }

  protected abstract renderBody(): unknown;

  override render(): unknown {
    return html`
      <div class="panel-header">
        <span class="panel-title">${this.panelTitle}</span>
        <button
          class="panel-close"
          aria-label="Close"
          @click=${(): void => this.close()}
        >×</button>
      </div>
      ${this.renderBody()}
    `;
  }
}
