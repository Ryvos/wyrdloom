import { describe, it, expect } from 'vitest';
import { makeActor, PLAYER_STATS, ENEMY_STATS } from '../../src/actors/Actor';
import { canAttack, performAttack, respawn, distanceBetween } from '../../src/systems/combat';
import { stepToward, tickEnemy } from '../../src/systems/ai';

describe('combat', () => {
  it('canAttack respects range, cooldown, life', () => {
    const player = makeActor('p', 'player', PLAYER_STATS, { tx: 0, ty: 0 });
    const enemy = makeActor('e', 'enemy', ENEMY_STATS, { tx: 1, ty: 0 });

    expect(canAttack(player, enemy, 0)).toBe(true);

    // Attack puts player on cooldown.
    performAttack(player, enemy, 100);
    expect(canAttack(player, enemy, 100)).toBe(false);
    expect(canAttack(player, enemy, 100 + PLAYER_STATS.atkCooldownMs)).toBe(true);

    // Out of range
    enemy.tile = { tx: 5, ty: 5 };
    expect(canAttack(player, enemy, 99999)).toBe(false);

    // Dead targets are not attackable
    enemy.tile = { tx: 1, ty: 0 };
    enemy.alive = false;
    expect(canAttack(player, enemy, 99999)).toBe(false);
  });

  it('performAttack kills on lethal hit', () => {
    const player = makeActor('p', 'player', PLAYER_STATS, { tx: 0, ty: 0 });
    const enemy = makeActor('e', 'enemy', ENEMY_STATS, { tx: 1, ty: 0 });
    enemy.hp = 10; // less than player.atk (25)

    const ev = performAttack(player, enemy, 100);
    expect(ev.killed).toBe(true);
    expect(ev.amount).toBe(25);
    expect(enemy.alive).toBe(false);
    expect(enemy.hp).toBe(0);
  });

  it('performAttack on already-dead does not double-fire killed flag', () => {
    const player = makeActor('p', 'player', PLAYER_STATS, { tx: 0, ty: 0 });
    const enemy = makeActor('e', 'enemy', ENEMY_STATS, { tx: 1, ty: 0 });
    enemy.alive = false;
    enemy.hp = 0;
    const ev = performAttack(player, enemy, 100);
    expect(ev.killed).toBe(false);
  });

  it('respawn restores hp and clears state', () => {
    const player = makeActor('p', 'player', PLAYER_STATS, { tx: 9, ty: 9 });
    player.hp = 0;
    player.alive = false;
    player.attackTarget = 'whatever';
    respawn(player, { tx: 6, ty: 6 });
    expect(player.alive).toBe(true);
    expect(player.hp).toBe(PLAYER_STATS.maxHp);
    expect(player.tile).toEqual({ tx: 6, ty: 6 });
    expect(player.attackTarget).toBeNull();
  });

  it('distanceBetween is Manhattan', () => {
    const a = makeActor('a', 'player', PLAYER_STATS, { tx: 0, ty: 0 });
    const b = makeActor('b', 'enemy', ENEMY_STATS, { tx: 3, ty: 4 });
    expect(distanceBetween(a, b)).toBe(7);
  });
});

describe('AI', () => {
  it('stepToward picks the larger-gap axis', () => {
    expect(stepToward({ tx: 0, ty: 0 }, { tx: 5, ty: 1 })).toEqual({ tx: 1, ty: 0 });
    expect(stepToward({ tx: 0, ty: 0 }, { tx: 1, ty: 5 })).toEqual({ tx: 0, ty: 1 });
    expect(stepToward({ tx: 0, ty: 0 }, { tx: 0, ty: 0 })).toEqual({ tx: 0, ty: 0 });
  });

  it('tickEnemy ignores player outside aggro range', () => {
    const player = makeActor('p', 'player', PLAYER_STATS, { tx: 0, ty: 0 });
    const enemy = makeActor('e', 'enemy', ENEMY_STATS, { tx: 10, ty: 10 });
    const r = tickEnemy(enemy, player, 9999);
    expect(r.moved).toBe(false);
    expect(r.damage).toBeNull();
  });

  it('tickEnemy chases player into aggro range', () => {
    const player = makeActor('p', 'player', PLAYER_STATS, { tx: 0, ty: 0 });
    const enemy = makeActor('e', 'enemy', ENEMY_STATS, { tx: 4, ty: 0 });
    enemy.lastMoveAt = 0;
    const r = tickEnemy(enemy, player, ENEMY_STATS.moveCooldownMs + 1);
    expect(r.moved).toBe(true);
    expect(enemy.tile).toEqual({ tx: 3, ty: 0 });
  });

  it('tickEnemy attacks when adjacent', () => {
    const player = makeActor('p', 'player', PLAYER_STATS, { tx: 0, ty: 0 });
    const enemy = makeActor('e', 'enemy', ENEMY_STATS, { tx: 1, ty: 0 });
    const r = tickEnemy(enemy, player, 9999);
    expect(r.damage).not.toBeNull();
    expect(r.damage?.amount).toBe(ENEMY_STATS.atk);
    expect(player.hp).toBe(PLAYER_STATS.maxHp - ENEMY_STATS.atk);
  });
});
