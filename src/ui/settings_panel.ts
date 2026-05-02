// Settings panel — global preferences (per spec §6 line 209). Settings
// persist to localStorage independent of save slots, so a fresh character
// inherits your chosen color-blind preset, reduce-motion, font scale, audio
// levels, and keybinds.
//
// All inputs bind to the live SettingsState; changes save immediately and
// fire SETTINGS_CHANGED_EVENT — main.ts consumes that event to apply
// runtime side effects (color-blind filter, font CSS variable).

import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { WyrdPanel, type PanelId } from './panel';
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  REMAPPABLE_ACTIONS,
  COLOR_BLIND_PRESETS,
  type ActionId,
  type ColorBlindPreset,
  type SettingsState,
} from '../systems/settings';

type Tab = 'video' | 'audio' | 'gameplay' | 'keybinds';

const ACTION_LABELS: Record<ActionId, string> = {
  'open-inventory': 'Inventory',
  'open-character': 'Character sheet',
  'open-bind': 'Bind skill',
  'open-imbuer': 'Imbuer',
  'open-echo-portal': 'Echo portal',
  'open-settings': 'Settings',
  'manual-save': 'Manual save (hubs)',
  'skill-1': 'Skill slot 1',
  'skill-2': 'Skill slot 2',
  'skill-3': 'Skill slot 3',
  'skill-4': 'Skill slot 4',
};

@customElement('wyrd-settings')
export class WyrdSettings extends WyrdPanel {
  panelId: PanelId = 'settings';
  panelTitle = 'Settings';

  static override styles = [
    WyrdPanel.styles,
    css`
      :host { min-width: 460px; }
      .tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 12px;
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
      }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px dashed #2c2a26;
        font-size: 13px;
      }
      .row label { opacity: 0.85; }
      .row input[type='range'] { width: 160px; }
      .row select, .row input[type='number'] {
        background: #0e0d0c;
        color: #d8d2bf;
        border: 1px solid #4a463d;
        font-family: inherit;
        font-size: 12px;
        padding: 2px 6px;
      }
      .row input[type='checkbox'] { transform: scale(1.2); }
      .keybind-key {
        background: #2a2820;
        border: 1px solid #6a5530;
        border-radius: 3px;
        padding: 3px 10px;
        font-family: ui-monospace, monospace;
        font-size: 11px;
        cursor: pointer;
        min-width: 80px;
        text-align: center;
      }
      .keybind-key.listening {
        background: #6a5530;
        color: #1a1814;
      }
      .footer {
        margin-top: 12px;
        font-size: 11px;
        opacity: 0.55;
      }
      .reset {
        margin-top: 12px;
        background: #2c2a26;
        color: #d8d2bf;
        border: 1px solid #4a463d;
        border-radius: 3px;
        padding: 6px 14px;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
      }
      .reset:hover { background: #3a3833; }
    `,
  ];

  @state() private _tab: Tab = 'video';
  @state() private _state: SettingsState = loadSettings();
  @state() private _listeningFor: ActionId | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this._maybeCaptureBind, true);
  }
  override disconnectedCallback(): void {
    window.removeEventListener('keydown', this._maybeCaptureBind, true);
    super.disconnectedCallback();
  }

  private _maybeCaptureBind = (e: KeyboardEvent): void => {
    if (!this._listeningFor) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code === 'Escape') {
      this._listeningFor = null;
      return;
    }
    const action = this._listeningFor;
    this._patch({ keybinds: { ...this._state.keybinds, [action]: e.code } });
    this._listeningFor = null;
  };

  private _patch(patch: Partial<SettingsState>): void {
    const next: SettingsState = {
      video: { ...this._state.video, ...(patch.video ?? {}) },
      audio: { ...this._state.audio, ...(patch.audio ?? {}) },
      gameplay: { ...this._state.gameplay, ...(patch.gameplay ?? {}) },
      keybinds: { ...this._state.keybinds, ...(patch.keybinds ?? {}) },
    };
    this._state = next;
    saveSettings(next);
  }

  private _resetDefaults(): void {
    const d = defaultSettings();
    this._state = d;
    saveSettings(d);
  }

  protected override renderBody(): unknown {
    return html`
      <div class="tabs">
        ${(['video', 'audio', 'gameplay', 'keybinds'] as Tab[]).map(
          (t) => html`
            <button
              class=${`tab ${this._tab === t ? 'active' : ''}`}
              data-testid="settings-tab-${t}"
              @click=${(): void => { this._tab = t; }}
            >${t.charAt(0).toUpperCase() + t.slice(1)}</button>
          `,
        )}
      </div>
      ${this._tab === 'video' ? this._renderVideo() : null}
      ${this._tab === 'audio' ? this._renderAudio() : null}
      ${this._tab === 'gameplay' ? this._renderGameplay() : null}
      ${this._tab === 'keybinds' ? this._renderKeybinds() : null}
      <button class="reset" data-testid="settings-reset" @click=${(): void => this._resetDefaults()}>
        Reset to defaults
      </button>
      <div class="footer">Settings persist across saves. Esc to close.</div>
    `;
  }

  private _renderVideo(): unknown {
    const v = this._state.video;
    return html`
      <div class="row">
        <label>Color-blind preset</label>
        <select
          data-testid="settings-colorblind"
          @change=${(e: Event): void => {
            const value = (e.target as HTMLSelectElement).value as ColorBlindPreset;
            this._patch({ video: { ...v, colorBlind: value } });
          }}
        >
          ${COLOR_BLIND_PRESETS.map(
            (p) => html`<option value=${p} ?selected=${v.colorBlind === p}>${p}</option>`,
          )}
        </select>
      </div>
      <div class="row">
        <label>Reduce motion</label>
        <input
          type="checkbox"
          data-testid="settings-reducemotion"
          .checked=${v.reduceMotion}
          @change=${(e: Event): void =>
            this._patch({ video: { ...v, reduceMotion: (e.target as HTMLInputElement).checked } })}
        />
      </div>
      <div class="row">
        <label>Font scale (${(v.fontScale * 100).toFixed(0)}%)</label>
        <input
          type="range" min="0.8" max="1.5" step="0.05"
          data-testid="settings-fontscale"
          .value=${String(v.fontScale)}
          @input=${(e: Event): void =>
            this._patch({ video: { ...v, fontScale: Number((e.target as HTMLInputElement).value) } })}
        />
      </div>
    `;
  }

  private _renderAudio(): unknown {
    const a = this._state.audio;
    const sliders: Array<[keyof typeof a & string, string]> = [
      ['masterVolume', 'Master'],
      ['sfxVolume', 'SFX'],
      ['musicVolume', 'Music'],
    ];
    return html`
      ${sliders.map(
        ([k, label]) => html`
          <div class="row">
            <label>${label} (${((a[k] as number) * 100).toFixed(0)}%)</label>
            <input
              type="range" min="0" max="1" step="0.05"
              data-testid="settings-${k}"
              .value=${String(a[k])}
              @input=${(e: Event): void =>
                this._patch({ audio: { ...a, [k]: Number((e.target as HTMLInputElement).value) } })}
            />
          </div>
        `,
      )}
      <div class="row">
        <label>Mute on window blur</label>
        <input
          type="checkbox"
          data-testid="settings-muteonblur"
          .checked=${a.muteOnBlur}
          @change=${(e: Event): void =>
            this._patch({ audio: { ...a, muteOnBlur: (e.target as HTMLInputElement).checked } })}
        />
      </div>
    `;
  }

  private _renderGameplay(): unknown {
    const g = this._state.gameplay;
    return html`
      <div class="row">
        <label>Hold to cast (vs. toggle)</label>
        <input
          type="checkbox"
          data-testid="settings-holdtocast"
          .checked=${g.holdToCast}
          @change=${(e: Event): void =>
            this._patch({ gameplay: { ...g, holdToCast: (e.target as HTMLInputElement).checked } })}
        />
      </div>
      <div class="row">
        <label>Always show subtitles</label>
        <input
          type="checkbox"
          data-testid="settings-alwayssubs"
          .checked=${g.alwaysSubtitles}
          @change=${(e: Event): void =>
            this._patch({ gameplay: { ...g, alwaysSubtitles: (e.target as HTMLInputElement).checked } })}
        />
      </div>
    `;
  }

  private _renderKeybinds(): unknown {
    return html`
      ${REMAPPABLE_ACTIONS.map((a) => {
        const code = this._state.keybinds[a];
        const listening = this._listeningFor === a;
        return html`
          <div class="row">
            <label>${ACTION_LABELS[a]}</label>
            <button
              class=${`keybind-key ${listening ? 'listening' : ''}`}
              data-testid="settings-keybind-${a}"
              @click=${(): void => { this._listeningFor = a; }}
            >${listening ? 'press a key…' : code}</button>
          </div>
        `;
      })}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wyrd-settings': WyrdSettings;
  }
}
