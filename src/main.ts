// WYRDLOOM v0.2.0 spike — Pixi iso canvas, click-to-move,
// 1 enemy + AI, 1 player skill (melee), HP bar, damage popups, death/respawn.

import { Application, Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
import { TILE_W, TILE_H, tileToScreen, screenToTile, roundTile, depthFor } from './engine/iso';
import type { TileCoord } from './engine/iso';
import { makeActor, PLAYER_STATS, ENEMY_STATS } from './actors/Actor';
import type { Actor } from './actors/Actor';
import { canAttack, performAttack, distanceBetween, respawn } from './systems/combat';
import { tickEnemy, stepToward } from './systems/ai';
import { makePlayerSprite, makeEnemySprite, makeHitFlash } from './fx/sprites';
import { spawnDamagePopup } from './fx/damage_popup';
import { mountHpBar } from './ui/hp_bar';
import type { HpBar } from './ui/hp_bar';

const GRID_W = 12;
const GRID_H = 12;
const PLAYER_SPAWN: TileCoord = { tx: 6, ty: 6 };
const RESPAWN_PLAYER_DELAY_MS = 2000;
const RESPAWN_ENEMY_DELAY_MS = 3000;

interface ActorView {
  readonly actor: Actor;
  readonly node: Container;
  readonly flash: Graphics;
  flashUntil: number;
}

interface World {
  readonly app: Application;
  readonly camera: Container;
  readonly world: Container;
  readonly target: Graphics;
  readonly hpBar: HpBar;
  readonly player: ActorView;
  readonly enemies: ActorView[];
  playerDeadAt: number;
  enemyRespawnQueue: { id: string; spawnAt: number }[];
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
  camera.addChild(world);

  drawTileGrid(world, GRID_W, GRID_H);

  const target = new Graphics();
  target.visible = false;
  world.addChild(target);

  // Spawn actors.
  const playerActor = makeActor('player', 'player', PLAYER_STATS, PLAYER_SPAWN);
  const playerView = mountActorView(world, playerActor, makePlayerSprite());

  const enemyActor = makeActor('enemy-0', 'enemy', ENEMY_STATS, { tx: 9, ty: 3 });
  const enemyView = mountActorView(world, enemyActor, makeEnemySprite());

  const hpBar = mountHpBar(hud);
  hpBar.set(playerActor.hp, playerActor.stats.maxHp);

  centerCamera(app, camera, playerActor.tile);

  const W: World = {
    app,
    camera,
    world,
    target,
    hpBar,
    player: playerView,
    enemies: [enemyView],
    playerDeadAt: 0,
    enemyRespawnQueue: [],
  };

  bindClickHandler(W);
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
    version: '0.2.0',
    dev: {
      // Reduce player hp to a known value (clamped to [0, maxHp]). For death-flow tests.
      setPlayerHp(n: number): void {
        playerActor.hp = Math.max(0, Math.min(playerActor.stats.maxHp, n));
        if (playerActor.hp === 0 && playerActor.alive) {
          // Mirror onPlayerDeath without needing the World handle.
          playerActor.alive = false;
          W.playerDeadAt = W.app.ticker.lastTime;
          W.hpBar.set(0, playerActor.stats.maxHp);
          W.hpBar.setDead(true);
          W.player.node.visible = false;
        } else {
          W.hpBar.set(playerActor.hp, playerActor.stats.maxHp);
        }
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

function bindClickHandler(W: World): void {
  W.world.eventMode = 'static';
  W.world.hitArea = { contains: () => true };

  W.world.on('pointerdown', (e: FederatedPointerEvent) => {
    if (!W.player.actor.alive) return;
    const local = W.world.toLocal(e.global);
    const tile = roundTile(...Object.values(screenToTile(local.x, local.y)) as [number, number]);

    // Out of bounds — ignore.
    if (tile.tx < 0 || tile.ty < 0 || tile.tx >= GRID_W || tile.ty >= GRID_H) return;

    // If click landed on an alive enemy, set attack target.
    const enemyHere = W.enemies.find(
      (v) => v.actor.alive && v.actor.tile.tx === tile.tx && v.actor.tile.ty === tile.ty,
    );
    if (enemyHere) {
      W.player.actor.attackTarget = enemyHere.actor.id;
      W.player.actor.goal = { ...enemyHere.actor.tile };
      showTarget(W, tile, true);
      return;
    }

    // Otherwise — walk to empty tile, clear any attack intent.
    W.player.actor.attackTarget = null;
    W.player.actor.goal = tile;
    showTarget(W, tile, false);
  });
}

function onTick(W: World, nowMs: number): void {
  // Player respawn timer.
  if (!W.player.actor.alive && W.playerDeadAt > 0 && nowMs - W.playerDeadAt >= RESPAWN_PLAYER_DELAY_MS) {
    respawn(W.player.actor, PLAYER_SPAWN);
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
        const t = randomEdgeTile();
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

  // Enemy AI.
  for (const view of W.enemies) {
    const result = tickEnemy(view.actor, W.player.actor, nowMs);
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
          W.target.visible = false;
          W.enemyRespawnQueue.push({
            id: targetView.actor.id,
            spawnAt: nowMs + RESPAWN_ENEMY_DELAY_MS,
          });
        }
      }
      return; // adjacent — don't try to move into the enemy
    } else {
      // Out of range — make sure goal tracks the moving enemy.
      player.goal = { ...targetView.actor.tile };
    }
  }

  // 2) Move toward goal on cooldown.
  if (!player.goal) return;
  if (nowMs - player.lastMoveAt < player.stats.moveCooldownMs) return;

  if (player.goal.tx === player.tile.tx && player.goal.ty === player.tile.ty) {
    player.goal = null;
    W.target.visible = false;
    return;
  }
  const next = stepToward(player.tile, player.goal);
  player.tile = next;
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

function drawTileGrid(world: Container, w: number, h: number): void {
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const tile = drawDiamond((tx + ty) % 2 === 0 ? 0x2c2a26 : 0x35322d, 0x4a463d);
      const { sx, sy } = tileToScreen(tx, ty);
      tile.position.set(sx, sy);
      tile.zIndex = depthFor(tx, ty);
      world.addChild(tile);
    }
  }
}

function drawDiamond(fill: number, stroke: number): Graphics {
  const g = new Graphics();
  g.poly([
    { x: 0, y: -TILE_H / 2 },
    { x: TILE_W / 2, y: 0 },
    { x: 0, y: TILE_H / 2 },
    { x: -TILE_W / 2, y: 0 },
  ]);
  g.fill(fill);
  g.stroke({ color: stroke, width: 1, alpha: 0.6 });
  return g;
}

function randomEdgeTile(): TileCoord {
  const edge = Math.floor(Math.random() * 4);
  const r = Math.floor(Math.random() * GRID_W);
  if (edge === 0) return { tx: r, ty: 0 };
  if (edge === 1) return { tx: r, ty: GRID_H - 1 };
  if (edge === 2) return { tx: 0, ty: r };
  return { tx: GRID_W - 1, ty: r };
}

function updateDebug(W: World): void {
  const el = document.querySelector<HTMLElement>('[data-testid="debug-readout"]');
  if (!el) return;
  const p = W.player.actor;
  const enemy = W.enemies[0]?.actor;
  const e = enemy ? `${enemy.alive ? 'alive' : 'dead'} hp ${enemy.hp}` : '—';
  const tgt = p.attackTarget ?? '—';
  el.textContent = `you ${p.tile.tx},${p.tile.ty} hp ${p.hp}  target ${tgt}  enemy ${e}`;
}

main().catch((err) => {
  console.error('boot failed', err);
  const el = document.querySelector<HTMLElement>('[data-testid="debug-readout"]');
  if (el) el.textContent = `boot failed: ${(err as Error).message}`;
});
