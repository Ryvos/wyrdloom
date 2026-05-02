// DOM-based resource bar — Rage / Bone Shards / Mana / Vigil per class.
// Mirrors the HP bar pattern but lives directly above it on the left edge.
// Color comes from the class def (Furyborn rage = orange-red).

const HOST_ID = 'resource-bar-host';

export interface ResourceBar {
  set(current: number, max: number, color: string, label: string): void;
  setHidden(hidden: boolean): void;
  destroy(): void;
}

export function mountResourceBar(parent: HTMLElement): ResourceBar {
  let host = parent.querySelector<HTMLElement>('#' + HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = `
      position: absolute;
      bottom: 70px;
      left: 16px;
      width: 240px;
      pointer-events: auto;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      color: #d8d2bf;
      text-align: left;
    `;
    host.innerHTML = `
      <div data-testid="resource-readout" style="margin-bottom: 4px; opacity: 0.85;">Rage 0 / 100</div>
      <div style="height: 10px; border: 1px solid #4a463d; background: #1a1814; border-radius: 2px; overflow: hidden;">
        <div data-testid="resource-fill" style="height: 100%; width: 0%; background: #c44a2a; transition: width 120ms linear;"></div>
      </div>
    `;
    parent.appendChild(host);
  }

  const readout = host.querySelector<HTMLElement>('[data-testid="resource-readout"]')!;
  const fill = host.querySelector<HTMLElement>('[data-testid="resource-fill"]')!;

  return {
    set(current: number, max: number, color: string, label: string): void {
      const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
      fill.style.width = `${pct * 100}%`;
      fill.style.background = color;
      readout.textContent = `${label} ${Math.floor(current)} / ${max}`;
    },
    setHidden(hidden: boolean): void {
      host!.style.display = hidden ? 'none' : 'block';
    },
    destroy(): void {
      host?.remove();
    },
  };
}
