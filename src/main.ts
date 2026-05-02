// WYRDLOOM v0.8.0 — Week 8: Class balance + 20 uniques + crafting + sockets + gems.
// New in v0.8.0: 'unique' rarity wired into the drop pipeline (forced on
// act-bosses), 20 unique items in data/uniques.json, 25 gems (5 kinds × 5
// qualities), Imbuer NPC in Whitestone with two recipes (3 magic →
// 1 rare, socket gem into empty socket), socket pips on tooltip + paper-doll,
// SaveAdapter v3 (no shape break — version-stamp bump only).

import { Application, Container, Graphics, ColorMatrixFilter, type FederatedPointerEvent } from 'pixi.js';
import { TILE_W, TILE_H, tileToScreen, screenToTile, roundTile, depthFor } from './engine/iso';
import type { TileCoord } from './engine/iso';
import {
  makeActor,
  makePlayerActor,
  ENEMY_STATS,
  HOLLOW_BISHOP_STATS,
  HOLLOW_BISHOP_PHASE_MODS,
  WORM_MOTHER_STATS,
  WORM_MOTHER_PHASE_MODS,
  bossPhase,
  type ActorStats,
  type PhaseMod,
} from './actors/Actor';
import { DEFAULT_CLASS_ID } from './systems/class';
import type { Actor } from './actors/Actor';
import type { NpcDef } from './actors/Npc';
import { canAttack, performAttack, distanceBetween, respawn } from './systems/combat';
import { tickEnemy } from './systems/ai';
import { isFloor, roomCenter, type DungeonMap } from './systems/procgen';
import { findPath, type PathfindGrid, type PathTile } from './systems/pathfinding';
import { drawDungeon } from './fx/tiles';
import {
  makePlayerSprite,
  makeEnemySprite,
  makeHollowBishopSprite,
  makeWormMotherSprite,
  makeHitFlash,
} from './fx/sprites';
import { makeNpcSprite } from './fx/npc_sprite';
import { spawnDamagePopup } from './fx/damage_popup';
import { mountHpBar } from './ui/hp_bar';
import type { HpBar } from './ui/hp_bar';
import { mountResourceBar } from './ui/resource_bar';
import type { ResourceBar } from './ui/resource_bar';
import { getClass } from './systems/class';
import { getSkill } from './systems/skills';
import { rollDrop, rollGemDrop } from './systems/loot';
import { imbueRare, socketGem } from './systems/crafting';
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
  INTENT_IMBUE_EVENT,
  INTENT_SOCKET_EVENT,
  type EquipIntent,
  type UnequipIntent,
  type DropIntent,
  type ImbueIntent,
  type SocketIntent,
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
import { makeFrostveinZone } from './levels/frostvein';
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
import './ui/imbuer_panel';

const APP_VERSION = '0.8.0';
const DEFAULT_CATACOMBS_SEED = 'catacombs-1';
const DEFAULT_FROSTVEIN_SEED = 'frostvein-1';
const DEFAULT_CHARACTER_NAME = 'Wyrdling';
const RESPAWN_PLAYER_DELAY_MS = 2000;
const RESPAWN_ENEMY_DELAY_MS = 3000;
const HOLLOW_BISHOP_ID = 'hollow-bishop';
const WORM_MOTHER_ID = 'worm-mother';
type BossId = typeof HOLLOW_BISHOP_ID | typeof WORM_MOTHER_ID;

function isBossId(id: string): id is BossId {
  return id === HOLLOW_BISHOP_ID || id === WORM_MOTHER_ID;
}

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
  readonly resourceBar: ResourceBar;
  // Per-skill cooldown tracker. Keyed by skillId; value is the ms timestamp
  // at which the skill last fired. Cleave (the basic attack) doesn't enter
  // this map — it shares the actor.lastAttackAt cooldown.
  readonly skillCdAt: Map<string, number>;
  // ms timestamp of the last frame; resource drift integrates over the delta.
  lastTickMs: number;
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
  wormMotherPhase: 1 | 2 | 3;
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

  const playerActor = makePlayerActor(DEFAULT_CLASS_ID, initialZone.playerEntry);
  const playerView = mountActorView(world, playerActor, makePlayerSprite());

  const hpBar = mountHpBar(hud);
  hpBar.set(playerActor.hp, playerActor.derivedStats.maxHp);

  const resourceBar = mountResourceBar(hud);
  const cls = getClass(DEFAULT_CLASS_ID)!;
  resourceBar.set(playerActor.resource ?? 0, cls.resourceMax, cls.resourceColor, capitalize(cls.resource));

  const tooltip = mountTooltip(hud);

  centerCamera(app, camera, playerActor.tile);

  const W: World = {
    app,
    camera,
    world,
    target,
    hpBar,
    resourceBar,
    skillCdAt: new Map<string, number>(),
    lastTickMs: 0,
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
    wormMotherPhase: 1,
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
    get wormMotherPhase(): number {
      return W.wormMotherPhase;
    },
    get classId(): string | null {
      return W.player.actor.classId ?? null;
    },
    get resource(): number {
      return W.player.actor.resource ?? 0;
    },
    get resourceMax(): number {
      const c = W.player.actor.classId ? getClass(W.player.actor.classId) : undefined;
      return c?.resourceMax ?? 0;
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
      openPanel(id: 'inventory' | 'character' | 'bind' | 'imbuer'): void {
        dispatchPanelToggle({ id, open: true });
      },
      closeAllPanels(): void {
        for (const id of ['inventory', 'character', 'bind', 'imbuer'] as const) {
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

// "rage" → "Rage". Used for the resource bar label.
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Add resourceOnHit (capped at resourceMax) to the player's resource pool.
// Called from the basic-attack code path after a successful hit lands. Skill
// activations don't gain resource — only the Cleave-style basic attack does.
function gainResourceOnHit(player: Actor): void {
  if (!player.classId || player.resource === undefined) return;
  const cls = getClass(player.classId);
  if (!cls) return;
  player.resource = Math.min(cls.resourceMax, player.resource + cls.resourceOnHit);
}

// Apply per-second resource drift. dtMs is wall-clock since last tick.
// Furyborn drains rage out of combat; Frostmark mana would regen here.
function tickResourceDrift(player: Actor, dtMs: number): void {
  if (!player.classId || player.resource === undefined) return;
  const cls = getClass(player.classId);
  if (!cls || cls.resourceRegen === 0) return;
  const next = player.resource + (cls.resourceRegen * dtMs) / 1000;
  player.resource = Math.max(0, Math.min(cls.resourceMax, next));
}

// Execute a hotbar-bound skill. Returns true if the skill fired (consumed
// resource + cooldown). Cleave is excluded — it's the implicit left-click
// strike, not a hotbar action.
function executeSkill(W: World, skillId: string, nowMs: number): boolean {
  const player = W.player.actor;
  const skill = getSkill(skillId);
  if (!skill || !skill.implemented || skill.kind === 'basic') return false;
  if (!player.classId || player.resource === undefined) return false;
  const cls = getClass(player.classId);
  if (!cls) return false;
  // Cooldown gate.
  const lastAt = W.skillCdAt.get(skillId) ?? Number.NEGATIVE_INFINITY;
  if (nowMs - lastAt < skill.cooldownMs) return false;
  // Resource gate.
  if (player.resource < skill.cost) return false;

  if (skill.kind === 'aoe') {
    // Whirlwind: hit every alive enemy within 1 tile.
    const damage = Math.floor(player.derivedStats.atk * skill.damageMul);
    for (const view of W.enemies) {
      if (!view.actor.alive) continue;
      if (distanceBetween(player, view.actor) > 1) continue;
      view.actor.hp = Math.max(0, view.actor.hp - damage);
      flashHit(view, nowMs);
      const screen = tileToScreen(view.actor.tile.tx, view.actor.tile.ty);
      const killed = view.actor.hp === 0 && view.actor.alive;
      spawnDamagePopup(W.world, screen.sx, screen.sy, damage, killed, W.app.ticker);
      if (killed) {
        view.actor.alive = false;
        view.actor.attackTarget = null;
        view.actor.goal = null;
        view.node.visible = false;
        handleKill(W, view, nowMs);
      } else if (isBossId(view.actor.id)) {
        maybeAdvanceBossPhase(W, view);
      }
    }
  } else if (skill.kind === 'mobility') {
    // Charge: teleport along the path toward the player goal up to 5 tiles.
    // Reuses the existing A* path so we never warp through walls.
    const path = W.playerPath;
    if (!path || path.length === 0) return false;
    const ix = W.playerPathIx;
    const lastIx = Math.min(path.length - 1, ix + 5);
    const dest = path[lastIx];
    if (!dest) return false;
    player.tile = { tx: dest.tx, ty: dest.ty };
    placeActorNode(W.player.node, player);
    centerCamera(W.app, W.camera, player.tile);
    W.playerPathIx = lastIx;
  }

  // Spend resource + record cooldown.
  player.resource = Math.max(0, player.resource - skill.cost);
  W.skillCdAt.set(skillId, nowMs);
  return true;
}

// Centralized kill handler — pulled out so both basic-attack and Whirlwind
// AoE go through the same drop / quest / respawn pipeline. Worm-Mother and
// Hollow Bishop both flow through here.
function handleKill(W: World, view: ActorView, nowMs: number): void {
  const id = view.actor.id;
  const isBoss = isBossId(id);
  W.killCount += 1;
  const dropSeed = isBoss
    ? `boss-${id}-${W.killCount}`
    : `${id}-${W.killCount}-${Math.floor(nowMs)}`;
  // Worm-Mother sits at monster level 16 (Act II final) vs 12 for Bishop.
  const monsterLevel = isBoss ? (id === WORM_MOTHER_ID ? 16 : 12) : 5;
  const item = rollDrop({ monsterLevel, seed: dropSeed, guaranteed: isBoss });
  if (item) {
    const dropTile = { ...view.actor.tile };
    const groundView = spawnGroundItem(W.world, W.app.ticker, item, dropTile);
    W.groundItems.push(groundView);
  }
  // Independent gem-drop roll (regular monsters only — bosses already drop a
  // guaranteed unique). Same dropSeed namespace, but rollGemDrop salts it.
  if (!isBoss) {
    const gemItem = rollGemDrop({ monsterLevel, seed: dropSeed });
    if (gemItem) {
      const dropTile = { ...view.actor.tile };
      const groundView = spawnGroundItem(W.world, W.app.ticker, gemItem, dropTile);
      W.groundItems.push(groundView);
    }
  }
  if (isBoss) {
    const done = onBossKilled(W.quests, id);
    for (const cid of done) activateNextMainAfter(W.quests, cid);
    void autoSave(W).catch((err) => console.error('autoSave failed:', err));
  } else {
    const done = onEnemyKilled(W.quests, W.currentZone.id);
    for (const cid of done) activateNextMainAfter(W.quests, cid);
  }
  syncStore(W);
  if (!isBoss) {
    W.enemyRespawnQueue.push({ id, spawnAt: nowMs + RESPAWN_ENEMY_DELAY_MS });
  }
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
    case 'frostvein':
      // Bright cold ice — slightly desaturated and tinted blue, a touch
      // brighter than the catacombs (open-cave feel vs claustrophobic crypt).
      f.saturate(-0.15, false);
      f.tint(0xb8d8f0, true);
      f.brightness(1.05, true);
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
  W.wormMotherPhase = 1;
}

// Spawn the actors a zone owns at boot or after a transition.
// - Whitestone: NPCs only (Quest-board for v0.6.0).
// - Catacombs: 1 grunt + Hollow Bishop in the boss room.
// - Frostvein: 1 grunt + Worm-Mother Vyl in the boss room.
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
    const map = W.currentZone.map;
    const grunt = makeActor('grunt-1', 'enemy', ENEMY_STATS, {
      tx: map.entrance.x + map.entrance.w - 1,
      ty: map.entrance.y + map.entrance.h - 1,
    });
    W.enemies.push(mountActorView(W.world, grunt, makeEnemySprite()));

    const bossTile = roomCenter(map.boss);
    const bishop = makeActor(HOLLOW_BISHOP_ID, 'enemy', HOLLOW_BISHOP_STATS, bossTile);
    W.enemies.push(mountActorView(W.world, bishop, makeHollowBishopSprite()));
    W.hollowBishopPhase = 1;
    return;
  }

  if (W.currentZone.id === 'frostvein') {
    const map = W.currentZone.map;
    const grunt = makeActor('grunt-fv-1', 'enemy', ENEMY_STATS, {
      tx: map.entrance.x + map.entrance.w - 1,
      ty: map.entrance.y + map.entrance.h - 1,
    });
    W.enemies.push(mountActorView(W.world, grunt, makeEnemySprite()));

    const bossTile = roomCenter(map.boss);
    const vyl = makeActor(WORM_MOTHER_ID, 'enemy', WORM_MOTHER_STATS, bossTile);
    W.enemies.push(mountActorView(W.world, vyl, makeWormMotherSprite()));
    W.wormMotherPhase = 1;
  }
}

// Switch to a different zone. Called when the player walks onto a doorway.
function loadZone(W: World, target: ZoneId, from: ZoneId | null): void {
  // Build the new zone first so any failure leaves the old one intact.
  let zone: Zone;
  if (target === 'whitestone') zone = makeWhitestoneZone();
  else if (target === 'frostvein') zone = makeFrostveinZone(DEFAULT_FROSTVEIN_SEED);
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
  // Imbuer service is its own dedicated panel — open it alongside the
  // teaser dialog so the player has the controls in front of them.
  if (def.kind === 'imbuer') {
    dispatchPanelToggle({ id: 'imbuer', open: true });
  }
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

// Boss config — id-keyed registry mapping each boss to its base stats, phase
// mods, and World-side phase counter field. Adding a new boss is a one-row
// extension.
const BOSS_CONFIG: Record<BossId, {
  baseStats: ActorStats;
  mods: readonly [PhaseMod, PhaseMod, PhaseMod];
  phaseField: 'hollowBishopPhase' | 'wormMotherPhase';
}> = {
  [HOLLOW_BISHOP_ID]: {
    baseStats: HOLLOW_BISHOP_STATS,
    mods: HOLLOW_BISHOP_PHASE_MODS,
    phaseField: 'hollowBishopPhase',
  },
  [WORM_MOTHER_ID]: {
    baseStats: WORM_MOTHER_STATS,
    mods: WORM_MOTHER_PHASE_MODS,
    phaseField: 'wormMotherPhase',
  },
};

// Boss phase advancement. Re-applies the per-boss phase-mod to base stats so
// atk + cooldown shift visibly between phases. Generalized over both Act-I
// and Act-II final bosses; the registry above picks the right curve.
function maybeAdvanceBossPhase(W: World, view: ActorView): void {
  const id = view.actor.id;
  if (!isBossId(id)) return;
  const cfg = BOSS_CONFIG[id];
  const next = bossPhase(view.actor.hp, view.actor.stats.maxHp);
  if (next === W[cfg.phaseField]) return;
  W[cfg.phaseField] = next;
  const mod = cfg.mods[next - 1]!;
  view.actor.derivedStats = {
    atk: Math.round(view.actor.stats.atk * mod.atkMul),
    maxHp: view.actor.stats.maxHp,
    armor: view.actor.derivedStats.armor,
  };
  // Cooldown lives on the readonly `stats` blob — replace the whole object.
  (view.actor as { stats: ActorStats }).stats = {
    ...view.actor.stats,
    atkCooldownMs: Math.round(cfg.baseStats.atkCooldownMs * mod.cooldownMul),
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

// Imbuer recipe: consume 3 magic same-slot inputs from the bag and add the
// resulting rare back into the bag. Aborts (no consumption) if validation
// fails or the bag has no room for the product.
function handleImbue(W: World, uids: ReadonlyArray<string>): void {
  if (uids.length !== 3) return;
  const items = uids
    .map((u) => W.inventory.slots.find((s) => s.item.uid === u)?.item)
    .filter((it): it is NonNullable<typeof it> => Boolean(it));
  if (items.length !== 3) return;
  const result = imbueRare(items);
  if (!result.ok || !result.product) {
    console.warn('imbue failed:', result.reason);
    return;
  }
  // Pre-check: removing 3 items frees their cells, so room is virtually
  // always available — but still gate to be safe with oddly-sized items.
  for (const u of uids) removeItem(W.inventory, u);
  if (!hasRoomFor(W.inventory, result.product)) {
    // Edge case — drop on the ground at the player's tile.
    const view = spawnGroundItem(W.world, W.app.ticker, result.product, {
      ...W.player.actor.tile,
    });
    W.groundItems.push(view);
  } else {
    addItem(W.inventory, result.product);
  }
  syncStore(W);
}

// Socket a gem into a target item. Target may live in the bag or be
// currently equipped — equipped items mutate in place and trigger a stat
// recalc so the gem's bonus shows up immediately on the player.
function handleSocket(
  W: World,
  detail: { gemUid: string; targetUid: string; socketIx?: number },
): void {
  const gemSlot = W.inventory.slots.find((s) => s.item.uid === detail.gemUid);
  if (!gemSlot || !gemSlot.item.gem) return;

  let target = W.inventory.slots.find((s) => s.item.uid === detail.targetUid)?.item;
  let equippedSlot: Slot | null = null;
  if (!target) {
    for (const slotId of ['weapon', 'head', 'chest', 'ring'] as const) {
      const it = W.player.actor.equipment[slotId];
      if (it && it.uid === detail.targetUid) {
        target = it;
        equippedSlot = slotId;
        break;
      }
    }
  }
  if (!target) return;

  const result = socketGem(target, gemSlot.item.gem, detail.socketIx);
  if (!result.ok || !result.item) {
    console.warn('socket failed:', result.reason);
    return;
  }
  removeItem(W.inventory, detail.gemUid);
  if (equippedSlot) {
    W.player.actor.equipment[equippedSlot] = result.item;
    recomputeStats(W);
  } else {
    // Replace the bag's stored Item so future tooltips/equip operations see
    // the updated sockets array.
    const bagSlot = W.inventory.slots.find((s) => s.item.uid === detail.targetUid);
    if (bagSlot) {
      // Inventory.slots is the live array; cast through unknown to swap the
      // readonly item ref. The bag's grid layout is unchanged.
      (bagSlot as { item: typeof bagSlot.item }).item = result.item;
    }
  }
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
  gameState.classId = player.classId ?? null;
  gameState.resource = player.resource ?? 0;
  const cls = player.classId ? getClass(player.classId) : undefined;
  gameState.resourceMax = cls?.resourceMax ?? 0;
  // Push the resource bar render here too so panels and the bar stay aligned
  // without a second event hop.
  if (cls && player.resource !== undefined) {
    W.resourceBar.set(player.resource, cls.resourceMax, cls.resourceColor, capitalize(cls.resource));
  }
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
    classId: W.player.actor.classId ?? DEFAULT_CLASS_ID,
    resource: W.player.actor.resource ?? 0,
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
  // Restore class first so the resource bar paints the right color before the
  // zone loader fires syncStore.
  W.player.actor.classId = s.classId;
  W.player.actor.resource = s.resource;
  // Restore zone — resets position to the zone's entry tile, then we overwrite
  // hp/inv/equip from the save.
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
  window.addEventListener(INTENT_IMBUE_EVENT, (e: Event) => {
    const detail = (e as CustomEvent<ImbueIntent>).detail;
    if (detail) handleImbue(W, detail.uids);
  });
  window.addEventListener(INTENT_SOCKET_EVENT, (e: Event) => {
    const detail = (e as CustomEvent<SocketIntent>).detail;
    if (detail) handleSocket(W, detail);
  });
  // Hotbar trigger — v0.7.0 wires the Furyborn kit. Cleave is implicit
  // (left-click), other skills fire here from key 1-4 or hotbar click.
  window.addEventListener(SKILL_TRIGGER_EVENT, (e: Event) => {
    const detail = (e as CustomEvent<{ slot: number; skillId: string }>).detail;
    if (!detail) return;
    const fired = executeSkill(W, detail.skillId, performance.now());
    if (fired) syncStore(W);
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
      const ids: PanelId[] = ['inventory', 'character', 'bind', 'imbuer'];
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
  // Resource drift — first tick has no delta, just record the timestamp.
  if (W.lastTickMs > 0) {
    const dt = nowMs - W.lastTickMs;
    if (dt > 0) {
      const before = W.player.actor.resource ?? 0;
      tickResourceDrift(W.player.actor, dt);
      // Only push the bar update when the value actually changed (rounding).
      if (Math.floor(before) !== Math.floor(W.player.actor.resource ?? 0)) {
        syncStore(W);
      }
    }
  }
  W.lastTickMs = nowMs;

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
        // Cleave: every landed hit feeds rage. Skill activations skip this.
        gainResourceOnHit(player);
        if (ev.killed) {
          player.attackTarget = null;
          player.goal = null;
          W.playerPath = null;
          W.target.visible = false;
          handleKill(W, targetView, nowMs);
        } else {
          // If this attack just dropped the Hollow Bishop into a new phase,
          // re-stat it. The phase mod scales atk + cooldown; stats stays
          // as-is so derivedStats-style recompute would zero it.
          if (isBossId(targetView.actor.id)) maybeAdvanceBossPhase(W, targetView);
          syncStore(W); // refresh resource bar after rage gain
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
