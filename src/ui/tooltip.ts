// DOM tooltip for ground items. Shows name in rarity color, base stat,
// and rolled affixes. Compares with currently equipped item in same slot.
// Floats at the mouse cursor.

import type { Item, ItemModType } from '../types/items';
import { RARITY_COLOR } from '../types/items';

const HOST_ID = 'item-tooltip';

function modLabel(t: ItemModType): string {
  switch (t) {
    case 'atk_flat':
      return 'Atk';
    case 'hp_flat':
      return 'Max HP';
  }
}

export interface Tooltip {
  showFor(item: Item, equipped: Item | undefined, x: number, y: number): void;
  move(x: number, y: number): void;
  hide(): void;
  destroy(): void;
}

export function mountTooltip(parent: HTMLElement): Tooltip {
  let host = parent.querySelector<HTMLElement>('#' + HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = `
      position: absolute;
      pointer-events: none;
      max-width: 280px;
      padding: 8px 10px;
      background: rgba(10, 10, 12, 0.94);
      border: 1px solid rgba(72, 68, 60, 0.9);
      border-radius: 3px;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      color: #d8d2bf;
      line-height: 1.4;
      display: none;
      z-index: 20;
    `;
    parent.appendChild(host);
  }

  function format(item: Item): string {
    const colorHex = '#' + RARITY_COLOR[item.rarity].toString(16).padStart(6, '0');
    const lines: string[] = [
      `<div style="color: ${colorHex}; font-weight: bold;">${escape(item.name)}</div>`,
      `<div style="opacity: 0.7;">${item.rarity} &middot; ilvl ${item.ilvl} &middot; ${item.slot}</div>`,
    ];
    if (item.baseDamage !== undefined) {
      lines.push(`<div>Damage: ${item.baseDamage}</div>`);
    }
    if (item.baseArmor !== undefined) {
      lines.push(`<div>Armor: ${item.baseArmor}</div>`);
    }
    for (const aff of item.affixes) {
      lines.push(`<div style="color: #6e8fc9;">+${aff.value} ${modLabel(aff.modType)} (${escape(aff.name)})</div>`);
    }
    return lines.join('');
  }

  return {
    showFor(item, equipped, x, y): void {
      let html = format(item);
      if (equipped && equipped.uid !== item.uid) {
        html += '<hr style="border:none; border-top:1px dashed rgba(72,68,60,0.7); margin: 6px 0;">';
        html += '<div style="opacity:0.7; font-size: 11px; margin-bottom: 4px;">Currently equipped:</div>';
        html += format(equipped);
      }
      host!.innerHTML = html;
      host!.style.display = 'block';
      this.move(x, y);
    },
    move(x, y): void {
      // Offset so the tooltip doesn't sit under the cursor.
      host!.style.left = `${x + 14}px`;
      host!.style.top = `${y + 14}px`;
    },
    hide(): void {
      host!.style.display = 'none';
    },
    destroy(): void {
      host?.remove();
    },
  };
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}
