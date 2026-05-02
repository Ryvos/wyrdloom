// Character creation modal — first-boot class pick + Hardcore opt-in.
//
// Per spec §4.2: 3 launch classes (Furyborn, Frostmark, Bonecaller — Bonecaller
// stubbed) + Sealwarden as a post-Act-III unlock. v0.11.0 ships Furyborn and
// Frostmark as fully playable; Sealwarden becomes selectable once any
// character has dismissed the Pact-Bearer ending overlay (account-wide,
// localStorage-backed so the unlock survives save deletes).
//
// The component never touches game state directly. It dispatches
// CHARACTER_CREATE_EVENT with the chosen options; main.ts picks it up and
// applies the class swap + name + hardcore flag, then writes the initial
// save. Same one-way flow as <wyrd-ending>.

import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CLASSES } from '../systems/class';
import type { ClassId } from '../types/class';

export const CHARACTER_CREATE_EVENT = 'wyrdloom:character-create';
export const SEALWARDEN_UNLOCK_KEY = 'wyrdloom:sealwarden-unlocked:v1';

export interface CharacterCreateDetail {
  readonly classId: ClassId;
  readonly characterName: string;
  readonly hardcore: boolean;
}

// v0.11.0 launch picks. Bonecaller (the third spec-listed class) is unimplemented
// in v0.11.0 and absent from CLASSES, so it isn't selectable here. Sealwarden is
// always rendered but may be disabled.
const SELECTABLE_IDS: ReadonlyArray<ClassId> = ['furyborn', 'frostmark', 'sealwarden'];

@customElement('wyrd-character-creation')
export class WyrdCharacterCreation extends LitElement {
  static override styles = css`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: auto;
      background: rgba(6, 6, 8, 0.92);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 50;
      font-family: system-ui, sans-serif;
      color: #d8d2bf;
    }
    :host([open]) {
      display: flex;
    }
    .panel {
      background: rgba(20, 18, 16, 0.98);
      border: 1px solid #4a463d;
      border-radius: 8px;
      padding: 28px 32px;
      min-width: 480px;
      max-width: 560px;
      box-shadow: 0 8px 36px rgba(0, 0, 0, 0.7);
    }
    h1 {
      font-size: 18px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      margin: 0 0 4px 0;
      opacity: 0.92;
    }
    .subtitle {
      font-size: 12px;
      opacity: 0.55;
      margin-bottom: 20px;
    }
    label.row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed #2c2a26;
      font-size: 13px;
    }
    label.row > span { opacity: 0.85; }
    input[type='text'] {
      background: #0e0d0c;
      color: #d8d2bf;
      border: 1px solid #4a463d;
      font-family: inherit;
      font-size: 13px;
      padding: 4px 8px;
      width: 200px;
    }
    input[type='checkbox'] { transform: scale(1.2); }
    .classes {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin: 12px 0 4px 0;
    }
    .class-card {
      background: #1a1816;
      border: 1px solid #2c2a26;
      border-radius: 4px;
      padding: 12px;
      cursor: pointer;
      text-align: left;
      color: inherit;
      font-family: inherit;
      transition: background 0.12s, border-color 0.12s;
    }
    .class-card:hover:not(:disabled) {
      background: #252320;
      border-color: #4a463d;
    }
    .class-card.selected {
      background: #2c2a26;
      border-color: #c8b878;
      box-shadow: 0 0 0 1px #c8b878 inset;
    }
    .class-card:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .class-name {
      font-size: 14px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .class-stat {
      font-size: 11px;
      opacity: 0.7;
      margin-bottom: 6px;
    }
    .class-locked {
      font-size: 10px;
      opacity: 0.55;
      font-style: italic;
    }
    .hardcore-note {
      font-size: 11px;
      opacity: 0.55;
      margin-top: 4px;
      font-style: italic;
    }
    .actions {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
    .begin {
      background: #2c2a26;
      color: #d8d2bf;
      border: 1px solid #c8b878;
      border-radius: 3px;
      padding: 8px 24px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .begin:hover { background: #3a3833; }
    .begin:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `;

  // Reflected so main.ts can `el.setAttribute('open', '')` to show.
  static override properties = {
    open: { type: Boolean, reflect: true },
  };

  open = false;

  @state() private _classId: ClassId = 'furyborn';
  @state() private _characterName = 'Wyrdling';
  @state() private _hardcore = false;
  @state() private _sealwardenUnlocked = false;

  override connectedCallback(): void {
    super.connectedCallback();
    try {
      this._sealwardenUnlocked =
        localStorage.getItem(SEALWARDEN_UNLOCK_KEY) === '1';
    } catch {
      this._sealwardenUnlocked = false;
    }
  }

  private _select(id: ClassId): void {
    if (id === 'sealwarden' && !this._sealwardenUnlocked) return;
    this._classId = id;
  }

  private _submit(): void {
    const name = this._characterName.trim();
    if (!name) return;
    this.dispatchEvent(
      new CustomEvent<CharacterCreateDetail>(CHARACTER_CREATE_EVENT, {
        bubbles: true,
        composed: true,
        detail: {
          classId: this._classId,
          characterName: name,
          hardcore: this._hardcore,
        },
      }),
    );
  }

  override render(): unknown {
    const cards = SELECTABLE_IDS.map((id) => {
      const def = CLASSES.find((c) => c.id === id);
      const locked = id === 'sealwarden' && !this._sealwardenUnlocked;
      const selected = this._classId === id;
      return html`
        <button
          class=${`class-card ${selected ? 'selected' : ''}`}
          ?disabled=${locked || !def}
          data-testid="cc-class-${id}"
          @click=${(): void => this._select(id)}
        >
          <div class="class-name">${def?.name ?? id}</div>
          <div class="class-stat">${def ? `${def.stat} · ${def.resource}` : ''}</div>
          ${locked
            ? html`<div class="class-locked">unlocks after Act III</div>`
            : html`<div class="class-stat">${def?.baseHp} HP · ${def?.baseAtk} atk</div>`}
        </button>
      `;
    });
    return html`
      <div class="panel">
        <h1>New Character</h1>
        <div class="subtitle">Choose a class. Hardcore is one life — death deletes the slot.</div>
        <div class="classes">${cards}</div>
        <label class="row">
          <span>Character name</span>
          <input
            type="text"
            data-testid="cc-name"
            maxlength="24"
            .value=${this._characterName}
            @input=${(e: Event): void => {
              this._characterName = (e.target as HTMLInputElement).value;
            }}
          />
        </label>
        <label class="row">
          <span>Hardcore (permadeath)</span>
          <input
            type="checkbox"
            data-testid="cc-hardcore"
            .checked=${this._hardcore}
            @change=${(e: Event): void => {
              this._hardcore = (e.target as HTMLInputElement).checked;
            }}
          />
        </label>
        ${this._hardcore
          ? html`<div class="hardcore-note">
              On death, your save slot is deleted. No respawn.
            </div>`
          : null}
        <div class="actions">
          <button
            class="begin"
            data-testid="cc-begin"
            ?disabled=${!this._characterName.trim()}
            @click=${(): void => this._submit()}
          >Begin</button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wyrd-character-creation': WyrdCharacterCreation;
  }
}
