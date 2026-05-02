// Bind-skill flow: the player clicks a hotbar slot, this panel opens and lists
// the available skills. Picking one writes the binding back into
// `gameState.hotbar`. Esc closes without binding.

import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { WyrdPanel, type PanelId, dispatchPanelToggle } from './panel';
import { SKILLS, type SkillDef } from '../systems/skills';
import { setHotbarBinding, pendingBindSlot } from './hotbar';

@customElement('wyrd-bind')
export class WyrdBind extends WyrdPanel {
  panelId: PanelId = 'bind';
  panelTitle = 'Bind Skill';

  static override styles = [
    WyrdPanel.styles,
    css`
      .target {
        font-size: 12px;
        opacity: 0.7;
        margin-bottom: 8px;
      }
      .skills {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .skill-row {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #0e0d0c;
        border: 1px solid #2c2a26;
        padding: 8px 10px;
        cursor: pointer;
        border-radius: 3px;
      }
      .skill-row:hover {
        border-color: #c7b27a;
      }
      .skill-icon {
        font-size: 22px;
        width: 28px;
        text-align: center;
      }
      .skill-name {
        flex: 1;
      }
      .empty-note {
        font-size: 12px;
        opacity: 0.55;
        margin-top: 12px;
      }
    `,
  ];

  @state() private _slotIndex: number | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('wyrdloom:panel-toggle', this._captureSlot);
  }
  override disconnectedCallback(): void {
    window.removeEventListener('wyrdloom:panel-toggle', this._captureSlot);
    super.disconnectedCallback();
  }

  private _captureSlot = (e: Event): void => {
    const detail = (e as CustomEvent<{ id: string; open?: boolean }>).detail;
    if (!detail || detail.id !== 'bind') return;
    if (detail.open) {
      this._slotIndex = pendingBindSlot.value;
    }
  };

  private _bind(skill: SkillDef): void {
    if (this._slotIndex === null) return;
    setHotbarBinding(this._slotIndex, { skillId: skill.id, label: skill.icon });
    pendingBindSlot.value = null;
    dispatchPanelToggle({ id: 'bind', open: false });
  }

  protected override renderBody(): unknown {
    const idx = this._slotIndex;
    return html`
      <div class="target" data-testid="bind-target">
        ${idx !== null ? `Binding to hotbar slot ${idx + 1}` : 'No slot targeted'}
      </div>
      <div class="skills">
        ${SKILLS.map(
          (s) => html`
            <div
              class="skill-row"
              data-testid="bind-skill-${s.id}"
              @click=${(): void => this._bind(s)}
            >
              <div class="skill-icon">${s.icon}</div>
              <div class="skill-name">${s.name}</div>
            </div>
          `,
        )}
      </div>
      <div class="empty-note">More skills land in v0.5.0 (spec §10).</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wyrd-bind': WyrdBind;
  }
}
