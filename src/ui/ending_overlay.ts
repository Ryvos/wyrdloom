// Ending overlay — shown once when the Pact-Bearer falls (Act III final).
// Centered DOM overlay that pauses input briefly via z-index but keeps the
// game world loaded so the player can keep wandering after dismissal.
//
// Lit-rendered, like the other panels, but distinct from WyrdPanel because
// the ending isn't a toggleable HUD panel — it's a one-shot lore moment.

import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

export const ENDING_SHOW_EVENT = 'wyrdloom:ending-show';
export const ENDING_DISMISS_EVENT = 'wyrdloom:ending-dismiss';

const ENDING_TEXT = [
  'The Pact-Bearer kneels in their own ash.',
  'The covenant burns out — first their breath, then the heat in the keep stones, then the colour of the sky.',
  'You walk out under a paler sun.',
  "Whitestone's bell hasn't rung in years. It rings now.",
];

@customElement('wyrd-ending')
export class WyrdEnding extends LitElement {
  static override styles = css`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      display: none;
      z-index: 30;
    }
    :host([open]) {
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      background: rgba(8, 6, 6, 0.7);
      backdrop-filter: blur(2px);
    }
    .frame {
      max-width: 520px;
      padding: 28px 36px;
      background: rgba(14, 12, 10, 0.96);
      border: 1px solid #6a5430;
      border-radius: 4px;
      box-shadow: 0 6px 32px rgba(0, 0, 0, 0.7);
      color: #e8d8b4;
      font-family: ui-serif, Georgia, serif;
      text-align: center;
    }
    .title {
      font-size: 14px;
      letter-spacing: 0.32em;
      text-transform: uppercase;
      opacity: 0.7;
      margin-bottom: 18px;
    }
    .line {
      font-size: 14px;
      line-height: 1.7;
      margin: 8px 0;
      opacity: 0;
      animation: fadein 1.4s ease-out forwards;
    }
    .line:nth-child(2) { animation-delay: 0.4s; }
    .line:nth-child(3) { animation-delay: 1.0s; }
    .line:nth-child(4) { animation-delay: 1.6s; }
    .line:nth-child(5) { animation-delay: 2.4s; }
    @keyframes fadein {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 0.92; transform: none; }
    }
    .btn {
      margin-top: 22px;
      background: #2a2018;
      color: #e8d8b4;
      border: 1px solid #6a5430;
      border-radius: 3px;
      padding: 8px 20px;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      opacity: 0;
      animation: fadein 0.8s ease-out 3.0s forwards;
    }
    .btn:hover {
      background: #3a2c20;
    }
  `;

  @state() private _open = false;

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(ENDING_SHOW_EVENT, this._onShow);
  }
  override disconnectedCallback(): void {
    window.removeEventListener(ENDING_SHOW_EVENT, this._onShow);
    super.disconnectedCallback();
  }

  private _onShow = (): void => {
    this._open = true;
    this.setAttribute('open', '');
  };

  private _dismiss(): void {
    this._open = false;
    this.removeAttribute('open');
    window.dispatchEvent(new CustomEvent(ENDING_DISMISS_EVENT));
  }

  override render(): unknown {
    if (!this._open) return null;
    return html`
      <div class="frame" data-testid="ending-frame">
        <div class="title">— Wyrdloom —</div>
        ${ENDING_TEXT.map((line) => html`<div class="line">${line}</div>`)}
        <button class="btn" data-testid="ending-continue" @click=${(): void => this._dismiss()}>
          Continue
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wyrd-ending': WyrdEnding;
  }
}
