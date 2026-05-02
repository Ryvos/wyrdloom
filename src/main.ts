// WYRDLOOM v0.6.0 — Week 6: Whitestone hub + quests + Hollow Bishop + saves.
// New in v0.6.0: zone system (hub ↔ catacombs), Quest-board NPC + quest
// tracker, Hollow Bishop boss with 3-phase combat, SaveAdapter (web +
// Tauri).

import { Application, Container, Graphics, ColorMatrixFilter, type FederatedPointerEvent } from 'pixi.js';
import { TILE_W, TILE_H, tileToScreen, screenToTile, roundTile, depthFor } from './engine/iso';
import type { TileCoord } from './engine/iso';
import {
  makeActor,
  PLAYER_STATS,
  ENEMY_STATS,
  HOLLOW_BISHOP_STATS,
  HOLLOW_BISHOP_PHASE_MODS,
  bossPhase,
} from './actors/Actor';
import type { Actor } from './actors/Actor';
import type { NpcDef } from './actors/Npc';
import { canAttack, performAttack, distanceBetween, respawn } from './systems/combat';
import { tickEnemy } from './systems/ai';
import { isFloor, roomCenter, type DungeonMap } from './systems/procgen';
import { findPath, type PathfindGrid, type PathTile } from './systems/pathfinding';
import { drawDungeon } from './fx/tiles';
import { makePlayerSprite, makeEnemySprite, makeHollowBishopSprite, makeHitFlash } from './fx/sprites';
import { makeNpcSprite } from './fx/npc_sprite';
import { spawnDamagePopup } from './fx/damage_popup';
import { mountHpBar } from './ui/hp_bar';
import type { HpBar } from './ui/hp_bar';
import { rollDrop } from './systems/loot';
import { computeDerivedStats, equip, unequip } from './systems/inventory';
import {
  makeInventory,
  addItem,
  removeItem,
  hasRoomFor,
  type Inventory,
} from './systems/bag';
import { spawnGroundItem } from './fx/ground_item';
import type { GroundItemView } from './fx/ground_item';
import { mountTooltip } from './ui/tooltip';
import type { Tooltip } from './ui/tooltip';
import {
  gameState,
  notifyState,
  INTENT_EQUIP_EVENT,
  INTENT_UNEQUIP_EVENT,
  INTENT_DROP_EVENT,
  type EquipIntent,
  type UnequipIntent,
  type DropIntent,
} from './ui/store';
import { dispatchPanelToggle, type PanelId } from './ui/panel';
import { SKILL_TRIGGER_EVENT } from './ui/hotbar';
import { QUEST_TOGGLE_EVENT } from './ui/quest_tracker';
import type { Slot } from './types/items';
import {
  type Zone,
  type ZoneId,
  isDoorway,
} from './systems/zone';
import { makeWhitestoneZone, WHITESTONE_NPCS } from './levels/whitestone';
import { makeCatacombsZone } from './levels/catacombs';
import {
  makeQuestState,
  onEnemyKilled,
  onEnterZone,
  onBossKilled,
  onRarePickup,
  activateNextMainAfter,
  type QuestState,
} from './systems/quests';
import { makeSaveAdapter } from './platform/save_factory';
import { buildSaveFile, type SaveAdapter, type SaveState, type SlotIndex } from './platform/SaveAdapter';

// Side-effect imports — register the custom elements with the browser.
import './ui/inventory_panel';
import './ui/character_panel';
import './ui/hotbar';
import './ui/bind_panel';
import './ui/quest_tracker';
import './ui/npc_dialog';

const APP_VERSION = '0.6.0';
const DEFAULT_CATACOMBS_SEED = 'catacombs-1';
const DEFAULT_CHARACTER_NAME = 'Wyrdling';
const RESPAWN_PLAYER_DELAY_MS = 2000;
const RESPAWN_ENEMY_DELAY_MS = 3000;
const HOLLOW_BISHOP_ID = 'hollow-bishop';

interface ActorView {
  readonly actor: Actor;
  readonly node: Container;
  readonly flash: Graphics;
  flashUntil: number;
}

interface NpcView {
  readonly def: NpcDef;
  readonly node: Container;
}

interface World {
  readonly app: Application;
  readonly camera: Container;
  readonly world: Container;
  readonly target: Graphics;
  readonly hpBar: HpBar;
  readonly tooltip: Tooltip;
  readonly player: ActorView;
  readonly inventory: Inventory;
  readonly saveAdapter: SaveAdapter;
  enemies: ActorView[];
  npcs: NpcView[];
  tileSprites: Container[];
  // Mutable so loadZone can swap them out.
  currentZone: Zone;
  dungeon: DungeonMap;
  grid: PathfindGrid;
  groundItems: GroundItemView[];
  playerDeadAt: number;
  enemyRespawnQueue: { id: string; spawnAt: number }[];
  killCount: number; // drives loot seed
  hoveringItemId: string | null;
  playerPath: PathTile[] | null;
  playerPathIx: number;
  // When the player is walking with a doorway as their goal, this remembers
  // which zone to transition to on arrival.
  pendingZoneTarget: ZoneId | null;
  // When the player is walking with an NPC as the destination, this remembers
  // which NPC to open dialog for on adjacency.
  pendingNpcInteract: string | null;
  // Quests + state.
  quests: QuestState;
  characterName: string;
  saveCreatedAt: number;
  // Hollow Bishop tracking — its current phase + last applied phase, so we
  // can re-apply the phase mod when HP crosses a threshold.
  hollowBishopPhase: 1 | 2 | 3;
}

async function main(): Promise<void> {
  const host = document.getElementById('app');
  const hud = document.getElementById('hud');
  if (!host || !hud) throw new Error('#app or #hud missing');

  const app = new Application();
  await app.init({
    background: '#0a0a0c',
    resizeTo: window,
    antialias: false,
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
  });
  host.appendChild(app.canvas);

  const camera = new Container();
  camera.label = 'camera';
  app.stage.addChild(camera);

  const world = new Container();
  world.label = 'world';
  world.sortableChildren = true;
  // Catacombs color grade — cool, dim, blue-grey. Replaced (or cleared) on
  // zone change for the warmer hub palette.
  camera.addChild(world);

  // Build the initial zone — Whitestone hub. Player starts at zone.playerEntry
  // since this is a fresh game.
  const initialZone = makeWhitestoneZone();
  const dungeon = initialZone.map;
  drawDungeon(world, dungeon);
  applyZoneFilter(world, initialZone.id);

  const target = new Graphics();
  target.visible = false;
  world.addChild(target);

  // Pathfinding grid is rebuilt on every zone change because `dungeon` itself
  // is swapped — but the closure captures the field, so the closure can stay.
  const grid: PathfindGrid = {
    get w(): number { return W.dungeon.w; },
    get h(): number { return W.dungeon.h; },
    isWalkable: (tx, ty): boolean => isFloor(W.dungeon, tx, ty),
  };

  const playerActor = makeActor('player', 'player', PLAYER_STATS, initialZone.playerEntry);
  const playerView = mountActorView(world, playerActor, makePlayerSprite());

  const hpBar = mountHpBar(hud);
  hpBar.set(playerActor.hp, playerActor.derivedStats.maxHp);

  const tooltip = mountTooltip(hud);

  centerCamera(app, camera, playerActor.tile);

  const W: World = {
    app,
    camera,
    world,
    target,
    hpBar,
    tooltip,
    player: playerView,
    enemies: [],
    npcs: [],
    tileSprites: [],
    inventory: makeInventory(),
    saveAdapter: makeSaveAdapter(),
    currentZone: initialZone,
    dungeon,
    grid,
    groundItems: [],
    playerDeadAt: 0,
    enemyRespawnQueue: [],
    killCount: 0,
    hoveringItemId: null,
    playerPath: null,
    playerPathIx: 0,
    pendingZoneTarget: null,
    pendingNpcInteract: null,
    quests: makeQuestState(),
    characterName: DEFAULT_CHARACTER_NAME,
    saveCreatedAt: Date.now(),
    hollowBishopPhase: 1,
  };

  // Initial zone setup — spawn NPCs (Whitestone) or enemies (Catacombs).
  spawnZoneActors(W, null);

  // Mount Lit panels into #hud. They're hidden until toggled.
  mountPanels(hud);
  // Wire reactive store + intent handlers (equip / unequip / drop / hotbar).
  syncStore(W);
  bindIntentHandlers(W);
  bindKeyboard(W);

  bindClickHandler(W);
  bindHoverHandler(W);
  app.ticker.add((tick) => onTick(W, tick.lastTime));

  updateDebug(W);

  // Debug handle for tests / DevTools. Reads are observational; the `dev`
  // namespace is mutating, kept narrow + clearly test-only so production code
  // never reaches for it.
  (window as unknown as { __wyrdloom: unknown }).__wyrdloom = {
    get playerTile() {
      return { ...playerActor.tile };
    },
    get playerHp() {
      return playerActor.hp;
    },
    get playerAlive() {
      return playerActor.alive;
    },
    get playerAtk() {
      return playerActor.derivedStats.atk;
    },
    get playerMaxHp() {
      return playerActor.derivedStats.maxHp;
    },
    get goal() {
      return playerActor.goal ? { ...playerActor.goal } : null;
    },
    get attackTarget() {
      return playerActor.attackTarget;
    },
    get enemies() {
      return W.enemies.map((v) => ({
        id: v.actor.id,
        tile: { ...v.actor.tile },
        hp: v.actor.hp,
        alive: v.actor.alive,
      }));
    },
    get groundItems() {
      return W.groundItems.map((g) => ({
        uid: g.item.uid,
        name: g.item.name,
        rarity: g.item.rarity,
        slot: g.item.slot,
        tile: { ...g.tile },
        affixCount: g.item.affixes.length,
      }));
    },
    get equipped() {
      return Object.entries(playerActor.equipment).map(([slot, item]) => ({
        slot,
        uid: item.uid,
        name: item.name,
        rarity: item.rarity,
      }));
    },
    get inventory() {
      return W.inventory.slots.map((s) => ({
        uid: s.item.uid,
        name: s.item.name,
        rarity: s.item.rarity,
        slot: s.item.slot,
        x: s.x,
        y: s.y,
      }));
    },
    get hotbar() {
      return gameState.hotbar.map((b) =>
        b ? { skillId: b.skillId, label: b.label } : null,
      );
    },
    get dungeon() {
      return {
        seed: W.dungeon.seed,
        w: W.dungeon.w,
        h: W.dungeon.h,
        roomCount: W.dungeon.rooms.length,
        entrance: { ...roomCenter(W.dungeon.entrance) },
        boss: { ...roomCenter(W.dungeon.boss) },
      };
    },
    isFloor(tx: number, ty: number): boolean {
      return isFloor(W.dungeon, tx, ty);
    },
    get zoneId() {
      return W.currentZone.id;
    },
    get npcs() {
      return W.npcs.map((n) => ({
        id: n.def.id,
        kind: n.def.kind,
        name: n.def.name,
        tile: { ...n.def.tile },
      }));
    },
    get quests() {
      return Object.values(W.quests.progress).map((p) => ({
        id: p.id,
        status: p.status,
        current: p.current,
      }));
    },
    get hollowBishopPhase(): number {
      return W.hollowBishopPhase;
    },
    version: APP_VERSION,
    dev: {
      setPlayerHp(n: number): void {
        playerActor.hp = Math.max(0, Math.min(playerActor.derivedStats.maxHp, n));
        if (playerActor.hp === 0 && playerActor.alive) {
          playerActor.alive = false;
          W.playerDeadAt = W.app.ticker.lastTime;
          W.hpBar.set(0, playerActor.derivedStats.maxHp);
          W.hpBar.setDead(true);
          W.player.node.visible = false;
        } else {
          W.hpBar.set(playerActor.hp, playerActor.derivedStats.maxHp);
        }
      },
      // Force a drop with a known seed at a specific tile (or the enemy's tile
      // if `tile` is omitted). Used by the loot e2e tests so we don't have to
      // wait for the random 80% drop chance and so swap-equip tests can pin
      // the replacement item at the player's current location.
      forceDrop(seed: string, tile?: { tx: number; ty: number }): void {
        const item = rollDrop({ monsterLevel: 5, seed });
        if (!item) return;
        let where: { tx: number; ty: number };
        if (tile) {
          where = { ...tile };
        } else {
          const enemy = W.enemies[0];
          if (!enemy) return;
          where = { ...enemy.actor.tile };
        }
        const view = spawnGroundItem(W.world, W.app.ticker, item, where);
        W.groundItems.push(view);
      },
      // Bypass walking + ground spawn — drop straight into the bag.
      giveItem(seed: string): void {
        const item = rollDrop({ monsterLevel: 5, seed });
        if (!item) return;
        if (!hasRoomFor(W.inventory, item)) return;
        addItem(W.inventory, item);
        syncStore(W);
      },
      openPanel(id: 'inventory' | 'character' | 'bind'): void {
        dispatchPanelToggle({ id, open: true });
      },
      closeAllPanels(): void {
        for (const id of ['inventory', 'character', 'bind'] as const) {
          dispatchPanelToggle({ id, open: false });
        }
      },
      equipFromInventoryByUid(uid: string): void {
        equipFromInventory(W, uid);
      },
      unequipSlot(slot: Slot): void {
        unequipToInventory(W, slot);
      },
      // Tell the player to walk to a tile, bypassing canvas-coord math in
      // tests. Returns the path length (or 0 if unreachable).
      walkTo(tx: number, ty: number): number {
        if (!isFloor(W.dungeon, tx, ty)) return 0;
        setPlayerGoal(W, { tx, ty }, null);
        return W.playerPath ? W.playerPath.length : 0;
      },
      // Teleport the player to an arbitrary floor tile. Used by combat e2e
      // tests so they don't have to march through procgen dungeons.
      teleportPlayer(tx: number, ty: number): boolean {
        if (!isFloor(W.dungeon, tx, ty)) return false;
        playerActor.tile = { tx, ty };
        playerActor.goal = null;
        playerActor.attackTarget = null;
        W.playerPath = null;
        placeActorNode(W.player.node, playerActor);
        centerCamera(W.app, W.camera, playerActor.tile);
        return true;
      },
      teleportEnemy(id: string, tx: number, ty: number): boolean {
        if (!isFloor(W.dungeon, tx, ty)) return false;
        const view = W.enemies.find((v) => v.actor.id === id);
        if (!view) return false;
        view.actor.tile = { tx, ty };
        placeActorNode(view.node, view.actor);
        return true;
      },
      // Set the player's attackTarget directly — equivalent to clicking the
      // enemy on a tile we know they're occupying.
      attackEnemy(id: string): boolean {
        const view = W.enemies.find((v) => v.actor.id === id && v.actor.alive);
        if (!view) return false;
        setPlayerGoal(W, { ...view.actor.tile }, view.actor.id);
        return true;
      },
      // Zone transition without walking — just teleport between zones.
      changeZone(target: ZoneId): void {
        loadZone(W, target, W.currentZone.id);
      },
      // Save / load harness. Slot 1 by default.
      async saveNow(slot: SlotIndex = 1): Promise<void> {
        await autoSave(W, slot);
      },
      async loadSlot(slot: SlotIndex = 1): Promise<boolean> {
        return await loadSaveAndApply(W, slot);
      },
      async deleteSlot(slot: SlotIndex = 1): Promise<void> {
        await W.saveAdapter.remove(slot);
      },
      async listSlots(): Promise<unknown[]> {
        const list = await W.saveAdapter.list();
        return list.map((s) => ({
          slot: s.slot,
          characterName: s.characterName,
          zoneId: s.zoneId,
          updatedAt: s.updatedAt,
          version: s.version,
        }));
      },
      async openNpcByKind(kind: 'questboard' | 'smith' | 'imbuer' | 'stash'): Promise<boolean> {
        const npc = W.npcs.find((n) => n.def.kind === kind);
        if (!npc) return false;
        openNpcDialog(W, npc.def);
        return true;
      },
    },
  };
}

function mountActorView(world: Container, actor: Actor, sprite: Container): ActorView {
  const node = new Container();
  node.label = `actor:${actor.id}`;
  const flash = makeHitFlash();
  node.addChild(sprite);
  node.addChild(flash);
  world.addChild(node);
  placeActorNode(node, actor);
  return { actor, node, flash, flashUntil: 0 };
}

function mountNpcView(world: Container, def: NpcDef): NpcView {
  const node = new Container();
  node.label = `npc:${def.id}`;
  const sprite = makeNpcSprite(def.kind);
  node.addChild(sprite);
  const { sx, sy } = tileToScreen(def.tile.tx, def.tile.ty);
  node.position.set(sx, sy);
  node.zIndex = depthFor(def.tile.tx, def.tile.ty) + 0.4;
  world.addChild(node);
  return { def, node };
}

// Hub palette = warmer; catacombs = cool blue-grey. Per spec §13:
// "Per-act color-grade LUT (warm I → cold II → blood III) via ColorMatrixFilter."
function applyZoneFilter(world: Container, zoneId: ZoneId): void {
  const f = new ColorMatrixFilter();
  switch (zoneId) {
    case 'whitestone':
      // Warm sunlit hub.
      f.brightness(1.05, false);
      f.tint(0xffe9b8, true);
      break;
    case 'catacombs':
      f.saturate(-0.25, false);
      f.tint(0x9aa6c0, true);
      f.brightness(0.85, true);
      break;
  }
  world.filters = [f];
}

// Tear down every tile sprite + actor + NPC in the world container, leaving
// the player + target reticle untouched. Called before loadZone re-renders.
function clearZone(W: World): void {
  for (const sprite of W.tileSprites) sprite.destroy({ children: true });
  W.tileSprites = [];
  for (const v of W.enemies) v.node.destroy({ children: true });
  W.enemies = [];
  for (const v of W.npcs) v.node.destroy({ children: true });
  W.npcs = [];
  for (const g of W.groundItems) g.destroy();
  W.groundItems = [];
  W.enemyRespawnQueue = [];
  W.hollowBishopPhase = 1;
}

// Spawn the actors a zone owns at boot or after a transition.
// - Whitestone: NPCs only (Quest-board for v0.6.0).
// - Catacombs: 1 grunt + Hollow Bishop in the boss room.
function spawnZoneActors(W: World, _fromZone: ZoneId | null): void {
  W.npcs = [];
  W.enemies = [];

  if (W.currentZone.id === 'whitestone') {
    for (const def of WHITESTONE_NPCS) {
      W.npcs.push(mountNpcView(W.world, def));
    }
    return;
  }

  if (W.currentZone.id === 'catacombs') {
    // Wandering grunt — placed near the entrance so the player meets one
    // before reaching the boss room.
    const map = W.currentZone.map;
    const grunt = makeActor('grunt-1', 'enemy', ENEMY_STATS, {
      tx: map.entrance.x + map.entrance.w - 1,
      ty: map.entrance.y + map.entrance.h - 1,
    });
    W.enemies.push(mountActorView(W.world, grunt, makeEnemySprite()));

    // Hollow Bishop — bosses spawn at the boss-room centre with a fresh
    // phase-1 atk profile.
    const bossTile = roomCenter(map.boss);
    const bishop = makeActor(HOLLOW_BISHOP_ID, 'enemy', HOLLOW_BISHOP_STATS, bossTile);
    W.enemies.push(mountActorView(W.world, bishop, makeHollowBishopSprite()));
    W.hollowBishopPhase = 1;
  }
}

// Switch to a different zone. Called when the player walks onto a doorway.
function loadZone(W: World, target: ZoneId, from: ZoneId | null): void {
  // Build the new zone first so any failure leaves the old one intact.
  let zone: Zone;
  if (target === 'whitestone') zone = makeWhitestoneZone();
  else zone = makeCatacombsZone(DEFAULT_CATACOMBS_SEED);

  // Tear down old visuals and actors.
  clearZone(W);

  // Render new tiles. drawDungeon attaches them to W.world; track them so
  // clearZone can destroy them next time.
  W.tileSprites = drawDungeon(W.world, zone.map);
  applyZoneFilter(W.world, zone.id);

  // Update mutable world fields.
  W.currentZone = zone;
  W.dungeon = zone.map;

  // Place player. If we know where they came from, prefer the matching
  // entry tile; otherwise drop them at the zone's playerEntry.
  const entry = (from && zone.entryFromZone?.[from]) ?? zone.playerEntry;
  W.player.actor.tile = { ...entry };
  W.player.actor.goal = null;
  W.player.actor.attackTarget = null;
  W.playerPath = null;
  W.playerPathIx = 0;
  W.pendingZoneTarget = null;
  W.pendingNpcInteract = null;
  placeActorNode(W.player.node, W.player.actor);
  centerCamera(W.app, W.camera, W.player.actor.tile);
  W.target.visible = false;

  spawnZoneActors(W, from);

  gameState.zoneId = zone.id;

  // Quest event hook + auto-save trigger.
  const completed = onEnterZone(W.quests, zone.id);
  for (const id of completed) activateNextMainAfter(W.quests, id);
  syncStore(W);
  void autoSave(W).catch((err) => console.error('autoSave failed:', err));
}

function bindClickHandler(W: World): void {
  W.world.eventMode = 'static';
  W.world.hitArea = { contains: () => true };

  W.world.on('pointerdown', (e: FederatedPointerEvent) => {
    if (!W.player.actor.alive) return;
    const local = W.world.toLocal(e.global);
    const tile = roundTile(...Object.values(screenToTile(local.x, local.y)) as [number, number]);

    if (tile.tx < 0 || tile.ty < 0 || tile.tx >= W.dungeon.w || tile.ty >= W.dungeon.h) return;

    // 1) Doorway tile? Walk to it; transition fires on arrival.
    const doorway = isDoorway(W.currentZone, tile.tx, tile.ty);
    if (doorway) {
      W.pendingNpcInteract = null;
      W.pendingZoneTarget = doorway.target;
      setPlayerGoal(W, tile, null);
      showTarget(W, tile, false);
      return;
    }

    // 2) NPC tile? Walk-to-adjacent and open dialog on arrival.
    const npc = W.npcs.find((n) => n.def.tile.tx === tile.tx && n.def.tile.ty === tile.ty);
    if (npc) {
      W.pendingZoneTarget = null;
      W.pendingNpcInteract = npc.def.id;
      // Walk to one tile *away* from the NPC so we don't try to stand on it.
      const adj = adjacentWalkable(W, npc.def.tile);
      if (adj) {
        setPlayerGoal(W, adj, null);
        showTarget(W, tile, false);
      } else {
        // Already adjacent; open dialog now.
        openNpcDialog(W, npc.def);
      }
      return;
    }

    // 3) Ground item on this tile? Pick it up if the player is here too,
    // otherwise walk to it (loot pickup is on contact).
    const groundHere = W.groundItems.find(
      (g) => g.tile.tx === tile.tx && g.tile.ty === tile.ty,
    );
    if (groundHere) {
      if (
        groundHere.tile.tx === W.player.actor.tile.tx &&
        groundHere.tile.ty === W.player.actor.tile.ty
      ) {
        pickUp(W, groundHere);
      } else {
        W.pendingZoneTarget = null;
        W.pendingNpcInteract = null;
        setPlayerGoal(W, tile, null);
      }
      return;
    }

    // 4) Alive enemy? Engage. Enemies stand on floor cells so the path
    // computed below will reach them. The combat tick stops one tile short.
    const enemyHere = W.enemies.find(
      (v) => v.actor.alive && v.actor.tile.tx === tile.tx && v.actor.tile.ty === tile.ty,
    );
    if (enemyHere) {
      W.pendingZoneTarget = null;
      W.pendingNpcInteract = null;
      setPlayerGoal(W, { ...enemyHere.actor.tile }, enemyHere.actor.id);
      showTarget(W, tile, true);
      return;
    }

    // 5) Walls reject the click — nothing happens, mirror v0.4.0 OOB behavior.
    if (!isFloor(W.dungeon, tile.tx, tile.ty)) return;

    // 6) Empty floor — walk.
    W.pendingZoneTarget = null;
    W.pendingNpcInteract = null;
    setPlayerGoal(W, tile, null);
    showTarget(W, tile, false);
  });
}

function adjacentWalkable(W: World, tile: TileCoord): TileCoord | null {
  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];
  for (let i = 0; i < 4; i++) {
    const tx = tile.tx + dx[i]!;
    const ty = tile.ty + dy[i]!;
    if (isFloor(W.dungeon, tx, ty)) return { tx, ty };
  }
  return null;
}

function openNpcDialog(W: World, def: NpcDef): void {
  W.pendingNpcInteract = null;
  window.dispatchEvent(
    new CustomEvent('wyrdloom:npc-dialog-open', {
      detail: { kind: def.kind, npcName: def.name },
    }),
  );
}

// Set the player's goal + attack target and recompute the A* path. Single
// entry point so we can't accidentally update goal without invalidating path.
function setPlayerGoal(W: World, goal: TileCoord, attackTarget: string | null): void {
  const player = W.player.actor;
  player.attackTarget = attackTarget;
  player.goal = goal;
  const path = findPath(W.grid, player.tile, goal);
  W.playerPath = path;
  W.playerPathIx = path ? 0 : 0; // 0 = current tile; advance from index 1
  if (path) showTarget(W, goal, attackTarget !== null);
}

function bindHoverHandler(W: World): void {
  // Hover tooltip — track the cursor on the canvas, show tooltip when over a
  // ground-item tile. Uses Pixi's federated pointermove which fires on the
  // canvas regardless of which child sprite the cursor is over.
  W.world.on('pointermove', (e: FederatedPointerEvent) => {
    const local = W.world.toLocal(e.global);
    const tile = roundTile(...Object.values(screenToTile(local.x, local.y)) as [number, number]);
    const ground = W.groundItems.find(
      (g) => g.tile.tx === tile.tx && g.tile.ty === tile.ty,
    );
    if (ground) {
      const equipped = W.player.actor.equipment[ground.item.slot];
      W.tooltip.showFor(ground.item, equipped, e.global.x, e.global.y);
      W.hoveringItemId = ground.item.uid;
    } else {
      W.tooltip.hide();
      W.hoveringItemId = null;
    }
  });

  W.world.on('pointerleave', () => {
    W.tooltip.hide();
    W.hoveringItemId = null;
  });
}

// Hollow Bishop phase advancement. Re-applies the phase-mod to base stats so
// atk + cooldown shift visibly between phases.
function maybeAdvanceBossPhase(W: World, view: ActorView): void {
  const next = bossPhase(view.actor.hp, view.actor.stats.maxHp);
  if (next === W.hollowBishopPhase) return;
  W.hollowBishopPhase = next;
  const mod = HOLLOW_BISHOP_PHASE_MODS[next - 1]!;
  // Mutate derivedStats — the source-of-truth for combat reads. The actor's
  // base `stats` is immutable so we layer the mod onto derivedStats only.
  view.actor.derivedStats = {
    atk: Math.round(view.actor.stats.atk * mod.atkMul),
    maxHp: view.actor.stats.maxHp,
    armor: view.actor.derivedStats.armor,
  };
  // Cooldown is read off `stats.atkCooldownMs`; we need to override that too.
  // Cheapest path: replace `stats` entirely (it's marked readonly but we own
  // the actor lifetime here and the discriminator on the cast is intentional).
  (view.actor as { stats: typeof view.actor.stats }).stats = {
    ...view.actor.stats,
    atkCooldownMs: Math.round(HOLLOW_BISHOP_STATS.atkCooldownMs * mod.cooldownMul),
  };
}

// v0.4.0: pickup goes into the bag (no auto-equip). If the bag is full,
// the item stays on the ground and the pickup is rejected.
function pickUp(W: World, view: GroundItemView): boolean {
  if (!hasRoomFor(W.inventory, view.item)) {
    return false;
  }
  addItem(W.inventory, view.item);

  // Quest event: rare-pickup objective ticks here (regardless of zone).
  if (view.item.rarity === 'rare') {
    const completed = onRarePickup(W.quests);
    for (const id of completed) activateNextMainAfter(W.quests, id);
  }

  W.groundItems = W.groundItems.filter((g) => g.item.uid !== view.item.uid);
  view.destroy();
  W.tooltip.hide();
  syncStore(W);
  return true;
}

// Equip from inventory: pull the item out of the bag, equip it, and put any
// previously-equipped item back into the bag (or drop it on the floor if the
// bag is now full because the new item was the last empty cell).
function equipFromInventory(W: World, uid: string): void {
  const inSlot = W.inventory.slots.find((s) => s.item.uid === uid);
  if (!inSlot) return;
  removeItem(W.inventory, uid);
  const player = W.player.actor;
  const replaced = equip(player.equipment, inSlot.item);
  if (replaced) {
    if (hasRoomFor(W.inventory, replaced)) {
      addItem(W.inventory, replaced);
    } else {
      // No room — drop at the player's tile.
      const replacedView = spawnGroundItem(W.world, W.app.ticker, replaced, {
        ...player.tile,
      });
      W.groundItems.push(replacedView);
    }
  }
  recomputeStats(W);
  syncStore(W);
}

function unequipToInventory(W: World, slot: Slot): void {
  const player = W.player.actor;
  const removed = unequip(player.equipment, slot);
  if (!removed) return;
  if (hasRoomFor(W.inventory, removed)) {
    addItem(W.inventory, removed);
  } else {
    // Bag full — drop on the ground.
    const view = spawnGroundItem(W.world, W.app.ticker, removed, { ...player.tile });
    W.groundItems.push(view);
  }
  recomputeStats(W);
  syncStore(W);
}

function dropFromInventory(W: World, uid: string): void {
  const inSlot = W.inventory.slots.find((s) => s.item.uid === uid);
  if (!inSlot) return;
  removeItem(W.inventory, uid);
  const view = spawnGroundItem(W.world, W.app.ticker, inSlot.item, {
    ...W.player.actor.tile,
  });
  W.groundItems.push(view);
  syncStore(W);
}

function recomputeStats(W: World): void {
  const player = W.player.actor;
  player.derivedStats = computeDerivedStats(
    player.stats.atk,
    player.stats.maxHp,
    player.equipment,
  );
  player.hp = Math.min(player.hp, player.derivedStats.maxHp);
  W.hpBar.set(player.hp, player.derivedStats.maxHp);
}

function syncStore(W: World): void {
  const player = W.player.actor;
  gameState.inventory = W.inventory;
  gameState.equipment = player.equipment;
  gameState.derived = player.derivedStats;
  gameState.baseAtk = player.stats.atk;
  gameState.baseMaxHp = player.stats.maxHp;
  gameState.quests = W.quests;
  gameState.zoneId = W.currentZone.id;
  notifyState();
}

function mountPanels(hud: HTMLElement): void {
  const inventory = document.createElement('wyrd-inventory');
  const character = document.createElement('wyrd-character');
  const bind = document.createElement('wyrd-bind');
  const hotbar = document.createElement('wyrd-hotbar');
  const tracker = document.createElement('wyrd-questtracker');
  const npcDialog = document.createElement('wyrd-npcdialog');
  hud.appendChild(inventory);
  hud.appendChild(character);
  hud.appendChild(bind);
  hud.appendChild(hotbar);
  hud.appendChild(tracker);
  hud.appendChild(npcDialog);
}

// Build a SaveState snapshot from the live world. Pure read.
function snapshotSaveState(W: World): SaveState {
  return {
    playerHp: W.player.actor.hp,
    playerStatsAtk: W.player.actor.stats.atk,
    playerStatsMaxHp: W.player.actor.stats.maxHp,
    inventory: W.inventory,
    equipment: W.player.actor.equipment,
    hotbar: gameState.hotbar.map((b) => (b ? { skillId: b.skillId, label: b.label } : null)),
    zoneId: W.currentZone.id,
    catacombsSeed: DEFAULT_CATACOMBS_SEED,
    killCount: W.killCount,
    quests: W.quests,
  };
}

async function autoSave(W: World, slot: SlotIndex = 1): Promise<void> {
  const file = buildSaveFile({
    characterName: W.characterName,
    appVersion: APP_VERSION,
    state: snapshotSaveState(W),
    createdAt: W.saveCreatedAt,
  });
  await W.saveAdapter.save(slot, file);
}

async function loadSaveAndApply(W: World, slot: SlotIndex = 1): Promise<boolean> {
  const file = await W.saveAdapter.load(slot);
  if (!file) return false;
  const s = file.state;
  // Restore zone first — that resets player position to entry. Then we
  // overwrite their HP / inventory / equipment from the save.
  loadZone(W, s.zoneId, null);
  W.player.actor.hp = s.playerHp;
  W.inventory.slots = s.inventory.slots;
  W.player.actor.equipment = s.equipment;
  W.player.actor.derivedStats = computeDerivedStats(
    W.player.actor.stats.atk,
    W.player.actor.stats.maxHp,
    W.player.actor.equipment,
  );
  W.player.actor.hp = Math.min(W.player.actor.hp, W.player.actor.derivedStats.maxHp);
  W.killCount = s.killCount;
  W.quests = s.quests;
  W.characterName = file.characterName;
  W.saveCreatedAt = file.createdAt;
  W.hpBar.set(W.player.actor.hp, W.player.actor.derivedStats.maxHp);
  syncStore(W);
  return true;
}

function bindIntentHandlers(W: World): void {
  window.addEventListener(INTENT_EQUIP_EVENT, (e: Event) => {
    const detail = (e as CustomEvent<EquipIntent>).detail;
    if (detail) equipFromInventory(W, detail.uid);
  });
  window.addEventListener(INTENT_UNEQUIP_EVENT, (e: Event) => {
    const detail = (e as CustomEvent<UnequipIntent>).detail;
    if (detail) unequipToInventory(W, detail.slot);
  });
  window.addEventListener(INTENT_DROP_EVENT, (e: Event) => {
    const detail = (e as CustomEvent<DropIntent>).detail;
    if (detail) dropFromInventory(W, detail.uid);
  });
  // Hotbar trigger — for v0.4.0 the only skill is `melee`, which is already
  // wired to click-to-attack. Keep this pure observation; v0.5.0 adds real
  // skill execution.
  window.addEventListener(SKILL_TRIGGER_EVENT, () => {
    /* no-op until v0.5.0 */
  });
}

function bindKeyboard(W: World): void {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    const key = e.key.toLowerCase();
    if (key === 'i') {
      dispatchPanelToggle({ id: 'inventory' });
      e.preventDefault();
    } else if (key === 'c') {
      dispatchPanelToggle({ id: 'character' });
      e.preventDefault();
    } else if (key === 'q') {
      window.dispatchEvent(new CustomEvent(QUEST_TOGGLE_EVENT));
      e.preventDefault();
    } else if (key === 's') {
      // Per spec §8: manual save in hubs only (anti-save-scum).
      if (W.currentZone.id === 'whitestone') {
        void autoSave(W).catch((err) => console.error('manual save failed:', err));
      }
      e.preventDefault();
    } else if (key === 'escape') {
      const ids: PanelId[] = ['inventory', 'character', 'bind'];
      for (const id of ids) dispatchPanelToggle({ id, open: false });
      window.dispatchEvent(new CustomEvent('wyrdloom:npc-dialog-close'));
      e.preventDefault();
    } else if (['1', '2', '3', '4'].includes(key)) {
      const slot = Number(key) - 1;
      const binding = gameState.hotbar[slot];
      if (binding) {
        window.dispatchEvent(
          new CustomEvent(SKILL_TRIGGER_EVENT, {
            detail: { slot, skillId: binding.skillId },
          }),
        );
      }
    }
  });
}

function onTick(W: World, nowMs: number): void {
  // Player respawn timer.
  if (!W.player.actor.alive && W.playerDeadAt > 0 && nowMs - W.playerDeadAt >= RESPAWN_PLAYER_DELAY_MS) {
    const spawn = roomCenter(W.dungeon.entrance);
    respawn(W.player.actor, spawn);
    W.playerPath = null;
    W.playerPathIx = 0;
    W.playerDeadAt = 0;
    placeActorNode(W.player.node, W.player.actor);
    centerCamera(W.app, W.camera, W.player.actor.tile);
    W.hpBar.set(W.player.actor.hp, W.player.actor.stats.maxHp);
    W.hpBar.setDead(false);
    W.player.node.visible = true;
  }

  // Enemy respawn queue.
  for (let i = W.enemyRespawnQueue.length - 1; i >= 0; i--) {
    const slot = W.enemyRespawnQueue[i];
    if (!slot) continue;
    if (nowMs >= slot.spawnAt) {
      const view = W.enemies.find((v) => v.actor.id === slot.id);
      if (view) {
        const t = randomFloorTile(W);
        respawn(view.actor, t);
        view.node.visible = true;
        placeActorNode(view.node, view.actor);
      }
      W.enemyRespawnQueue.splice(i, 1);
    }
  }

  // Player movement / attack.
  if (W.player.actor.alive) {
    tickPlayer(W, nowMs);
  }

  // Enemy AI — pass the grid so enemies path around walls.
  for (const view of W.enemies) {
    const result = tickEnemy(view.actor, W.player.actor, nowMs, W.grid);
    if (result.moved) placeActorNode(view.node, view.actor);
    if (result.damage) {
      flashHit(W.player, nowMs);
      const screen = tileToScreen(W.player.actor.tile.tx, W.player.actor.tile.ty);
      spawnDamagePopup(W.world, screen.sx, screen.sy, result.damage.amount, false, W.app.ticker);
      W.hpBar.set(W.player.actor.hp, W.player.actor.stats.maxHp);
      if (result.damage.killed) onPlayerDeath(W, nowMs);
    }
  }

  // Tick flash overlays.
  for (const v of [W.player, ...W.enemies]) {
    v.flash.visible = nowMs < v.flashUntil;
  }

  updateDebug(W);
}

function tickPlayer(W: World, nowMs: number): void {
  const player = W.player.actor;

  // 1) If we have an attack target and it's in range, attack instead of move.
  if (player.attackTarget) {
    const targetView = W.enemies.find((v) => v.actor.id === player.attackTarget);
    if (!targetView || !targetView.actor.alive) {
      player.attackTarget = null;
      player.goal = null;
      W.playerPath = null;
      W.target.visible = false;
    } else if (distanceBetween(player, targetView.actor) <= player.stats.atkRange) {
      if (canAttack(player, targetView.actor, nowMs)) {
        const ev = performAttack(player, targetView.actor, nowMs);
        flashHit(targetView, nowMs);
        const screen = tileToScreen(targetView.actor.tile.tx, targetView.actor.tile.ty);
        spawnDamagePopup(W.world, screen.sx, screen.sy, ev.amount, ev.killed, W.app.ticker);
        if (ev.killed) {
          targetView.node.visible = false;
          player.attackTarget = null;
          player.goal = null;
          W.playerPath = null;
          W.target.visible = false;
          const isBoss = targetView.actor.id === HOLLOW_BISHOP_ID;
          // Roll a drop. Boss is guaranteed to drop a high-tier item using a
          // boss-pinned seed; grunts use the random seed they had pre-v0.6.0.
          W.killCount += 1;
          const dropSeed = isBoss
            ? `boss-${HOLLOW_BISHOP_ID}-${W.killCount}`
            : `${targetView.actor.id}-${W.killCount}-${Math.floor(nowMs)}`;
          const item = rollDrop({
            monsterLevel: isBoss ? 12 : 5,
            seed: dropSeed,
          });
          if (item) {
            const dropTile = { ...targetView.actor.tile };
            const groundView = spawnGroundItem(W.world, W.app.ticker, item, dropTile);
            W.groundItems.push(groundView);
          }
          // Quest events.
          if (isBoss) {
            const done = onBossKilled(W.quests, HOLLOW_BISHOP_ID);
            for (const id of done) activateNextMainAfter(W.quests, id);
            void autoSave(W).catch((err) => console.error('autoSave failed:', err));
          } else {
            const done = onEnemyKilled(W.quests, W.currentZone.id);
            for (const id of done) activateNextMainAfter(W.quests, id);
          }
          syncStore(W);
          // Bosses don't respawn; grunts do.
          if (!isBoss) {
            W.enemyRespawnQueue.push({
              id: targetView.actor.id,
              spawnAt: nowMs + RESPAWN_ENEMY_DELAY_MS,
            });
          }
        } else {
          // If this attack just dropped the Hollow Bishop into a new phase,
          // re-stat it. The phase mod scales atk + cooldown; stats stays
          // as-is so derivedStats-style recompute would zero it.
          if (targetView.actor.id === HOLLOW_BISHOP_ID) maybeAdvanceBossPhase(W, targetView);
        }
      }
      return; // adjacent — don't try to move into the enemy
    } else {
      // Out of range — re-path to the (possibly moving) target each tick.
      const targetTile = targetView.actor.tile;
      if (
        !player.goal ||
        player.goal.tx !== targetTile.tx ||
        player.goal.ty !== targetTile.ty ||
        !W.playerPath
      ) {
        player.goal = { ...targetTile };
        W.playerPath = findPath(W.grid, player.tile, player.goal);
        W.playerPathIx = 0;
      }
    }
  }

  // 2) Walk the cached path on cooldown.
  if (!W.playerPath || !player.goal) return;
  if (nowMs - player.lastMoveAt < player.stats.moveCooldownMs) return;

  // path[0] is current tile; advance the index to step path[ix+1].
  const nextIx = W.playerPathIx + 1;
  const next = W.playerPath[nextIx];
  if (!next) {
    // Reached the end of the path.
    player.goal = null;
    W.playerPath = null;
    W.target.visible = false;
    // Doorway transition fires on arrival.
    if (W.pendingZoneTarget) {
      const target = W.pendingZoneTarget;
      const from = W.currentZone.id;
      W.pendingZoneTarget = null;
      loadZone(W, target, from);
      return;
    }
    // NPC interaction fires on arrival adjacent.
    if (W.pendingNpcInteract) {
      const npc = W.npcs.find((n) => n.def.id === W.pendingNpcInteract);
      if (npc) openNpcDialog(W, npc.def);
      W.pendingNpcInteract = null;
    }
    return;
  }
  player.tile = { tx: next.tx, ty: next.ty };
  W.playerPathIx = nextIx;
  player.lastMoveAt = nowMs;
  placeActorNode(W.player.node, player);
  centerCamera(W.app, W.camera, player.tile);
}

function onPlayerDeath(W: World, nowMs: number): void {
  W.playerDeadAt = nowMs;
  W.hpBar.set(0, W.player.actor.stats.maxHp);
  W.hpBar.setDead(true);
  W.player.node.visible = false;
}

function flashHit(v: ActorView, nowMs: number): void {
  v.flashUntil = nowMs + 80; // 4-frame freeze at 60fps; spec §12 risk-mitigation
}

function placeActorNode(node: Container, actor: Actor): void {
  const { sx, sy } = tileToScreen(actor.tile.tx, actor.tile.ty);
  node.position.set(sx, sy);
  node.zIndex = depthFor(actor.tile.tx, actor.tile.ty) + (actor.kind === 'player' ? 0.5 : 0.6);
}

function showTarget(W: World, tile: TileCoord, hostile: boolean): void {
  const s = tileToScreen(tile.tx, tile.ty);
  W.target.clear();
  W.target.poly([
    { x: s.sx, y: s.sy - TILE_H / 2 },
    { x: s.sx + TILE_W / 2, y: s.sy },
    { x: s.sx, y: s.sy + TILE_H / 2 },
    { x: s.sx - TILE_W / 2, y: s.sy },
  ]);
  W.target.stroke({
    color: hostile ? 0xb84a3a : 0xb88a3a,
    width: 2,
    alpha: 0.9,
  });
  W.target.zIndex = depthFor(tile.tx, tile.ty) + 1;
  W.target.visible = true;
}

function centerCamera(app: Application, camera: Container, tile: TileCoord): void {
  const { sx, sy } = tileToScreen(tile.tx, tile.ty);
  camera.position.set(app.screen.width / 2 - sx, app.screen.height / 2 - sy);
}

// Random walkable tile, used for enemy respawn placement. Limited tries; falls
// back to the boss room if the dungeon is somehow extremely sparse (shouldn't
// happen — validator guarantees at least one connected component).
function randomFloorTile(W: World): TileCoord {
  for (let i = 0; i < 64; i++) {
    const tx = Math.floor(Math.random() * W.dungeon.w);
    const ty = Math.floor(Math.random() * W.dungeon.h);
    if (isFloor(W.dungeon, tx, ty)) return { tx, ty };
  }
  return roomCenter(W.dungeon.boss);
}

function updateDebug(W: World): void {
  const el = document.querySelector<HTMLElement>('[data-testid="debug-readout"]');
  if (!el) return;
  const p = W.player.actor;
  const enemy = W.enemies[0]?.actor;
  const e = enemy ? `${enemy.alive ? 'alive' : 'dead'} hp ${enemy.hp}` : '—';
  const wpn = p.equipment.weapon?.name ?? 'unarmed';
  el.textContent = `you ${p.tile.tx},${p.tile.ty}  hp ${p.hp}/${p.derivedStats.maxHp}  atk ${p.derivedStats.atk} (${wpn})  enemy ${e}  loot ${W.groundItems.length}`;
}

main().catch((err) => {
  console.error('boot failed', err);
  const el = document.querySelector<HTMLElement>('[data-testid="debug-readout"]');
  if (el) el.textContent = `boot failed: ${(err as Error).message}`;
});
