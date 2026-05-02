// DOM-based HP orb. Sits in the HUD div, updated imperatively.
// Per BUILD_PROMPT §6.1: HUD is DOM overlaid on Pixi, not in-canvas.
// SVG clip-path liquid fill is for a later milestone — v0.2.0 ships a
// horizontal bar, which is enough to verify the pipeline.

const HOST_ID = 'hp-bar-host';

export interface HpBar {
  set(current: number, max: number): void;
  setDead(dead: boolean): void;
  destroy(): void;
}

export function mountHpBar(parent: HTMLElement): HpBar {
  let host = parent.querySelector<HTMLElement>('#' + HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = `
      position: absolute;
      bottom: 16px;
      left: 16px;
      width: 240px;
      pointer-events: auto;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      color: #d8d2bf;
      text-align: left;
    `;
    host.innerHTML = `
      <div data-testid="hp-readout" style="margin-bottom: 4px; opacity: 0.85;">HP 100 / 100</div>
      <div style="height: 14px; border: 1px solid #4a463d; background: #1a1814; border-radius: 2px; overflow: hidden;">
        <div data-testid="hp-fill" style="height: 100%; width: 100%; background: linear-gradient(180deg, #b84a3a, #6b2a26); transition: width 120ms linear;"></div>
      </div>
      <div data-testid="hp-status" style="margin-top: 6px; opacity: 0; transition: opacity 200ms; color: #b84a3a; font-weight: bold; letter-spacing: 0.2em;">DEAD</div>
    `;
    parent.appendChild(host);
  }

  const readout = host.querySelector<HTMLElement>('[data-testid="hp-readout"]')!;
  const fill = host.querySelector<HTMLElement>('[data-testid="hp-fill"]')!;
  const status = host.querySelector<HTMLElement>('[data-testid="hp-status"]')!;

  return {
    set(current: number, max: number): void {
      const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
      fill.style.width = `${pct * 100}%`;
      readout.textContent = `HP ${current} / ${max}`;
    },
    setDead(dead: boolean): void {
      status.style.opacity = dead ? '1' : '0';
    },
    destroy(): void {
      host?.remove();
    },
  };
}
