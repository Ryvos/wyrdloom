// Shared type declaration for the runtime debug handle exposed at
// `window.__wyrdloom`. Both e2e spec files reference it via triple-slash;
// declaring it once here avoids merging conflicts across files.
//
// As an ambient .d.ts (no top-level imports/exports), `interface Window` here
// merges into the global Window type without needing `declare global`.

interface Window {
  __wyrdloom: {
    readonly version: string;
    readonly playerTile: { tx: number; ty: number };
    readonly playerHp: number;
    readonly playerMaxHp: number;
    readonly playerAlive: boolean;
    readonly playerAtk: number;
    readonly goal: { tx: number; ty: number } | null;
    readonly attackTarget: string | null;
    readonly enemies: ReadonlyArray<{
      id: string;
      tile: { tx: number; ty: number };
      hp: number;
      alive: boolean;
    }>;
    readonly groundItems: ReadonlyArray<{
      uid: string;
      name: string;
      rarity: string;
      slot: string;
      tile: { tx: number; ty: number };
      affixCount: number;
    }>;
    readonly equipped: ReadonlyArray<{
      slot: string;
      uid: string;
      name: string;
      rarity: string;
    }>;
    readonly inventory: ReadonlyArray<{
      uid: string;
      name: string;
      rarity: string;
      slot: string;
      x: number;
      y: number;
    }>;
    readonly hotbar: ReadonlyArray<{ skillId: string; label: string } | null>;
    readonly dev: {
      setPlayerHp(n: number): void;
      forceDrop(seed: string, tile?: { tx: number; ty: number }): void;
      giveItem(seed: string): void;
      openPanel(id: 'inventory' | 'character' | 'bind'): void;
      closeAllPanels(): void;
      equipFromInventoryByUid(uid: string): void;
      unequipSlot(slot: 'weapon' | 'head' | 'chest' | 'ring'): void;
    };
  };
}
