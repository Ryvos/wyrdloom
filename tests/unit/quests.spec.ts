// Quest state machine tests — auto-activation, kill counting, sequential
// main-quest unlocking, boss kill, rare pickup.

import { describe, expect, it } from 'vitest';
import {
  makeQuestState,
  onEnterZone,
  onEnemyKilled,
  onBossKilled,
  onRarePickup,
  activateNextMainAfter,
  activateQuest,
  questStatus,
  questDef,
} from '../../src/systems/quests';

describe('quests', () => {
  it('auto-activates the first main quest at construction', () => {
    const s = makeQuestState();
    expect(questStatus(s, 'q-intro-descend')).toBe('active');
    expect(questStatus(s, 'q-act1-bones')).toBe('inactive');
  });

  it('intro quest completes on first catacombs entry', () => {
    const s = makeQuestState();
    const completed = onEnterZone(s, 'catacombs');
    expect(completed).toEqual(['q-intro-descend']);
    expect(questStatus(s, 'q-intro-descend')).toBe('completed');
  });

  it('zone enter does nothing for irrelevant zones', () => {
    const s = makeQuestState();
    expect(onEnterZone(s, 'frostvein')).toEqual([]);
    expect(questStatus(s, 'q-intro-descend')).toBe('active');
  });

  it('activateNextMainAfter unlocks the sequel main quest', () => {
    const s = makeQuestState();
    onEnterZone(s, 'catacombs'); // completes intro
    const next = activateNextMainAfter(s, 'q-intro-descend');
    expect(next).toBe('q-act1-bones');
    expect(questStatus(s, 'q-act1-bones')).toBe('active');
  });

  it('kill count quest progresses + completes after the threshold', () => {
    const s = makeQuestState();
    activateQuest(s, 'q-act1-bones');
    expect(onEnemyKilled(s, 'catacombs')).toEqual([]); // 1
    expect(onEnemyKilled(s, 'catacombs')).toEqual([]); // 2
    expect(onEnemyKilled(s, 'catacombs')).toEqual(['q-act1-bones']); // 3 → done
    expect(questStatus(s, 'q-act1-bones')).toBe('completed');
  });

  it('kill count ignores other zones', () => {
    const s = makeQuestState();
    activateQuest(s, 'q-act1-bones');
    onEnemyKilled(s, 'frostvein');
    onEnemyKilled(s, 'frostvein');
    onEnemyKilled(s, 'frostvein');
    expect(questStatus(s, 'q-act1-bones')).toBe('active');
  });

  it('rare pickup completes the relic quest', () => {
    const s = makeQuestState();
    activateQuest(s, 'q-act1-relic');
    const completed = onRarePickup(s);
    expect(completed).toEqual(['q-act1-relic']);
    expect(questStatus(s, 'q-act1-relic')).toBe('completed');
  });

  it('boss kill completes the bishop quest', () => {
    const s = makeQuestState();
    activateQuest(s, 'q-act1-bishop');
    expect(onBossKilled(s, 'frostvein-vyl')).toEqual([]); // wrong boss
    expect(onBossKilled(s, 'hollow-bishop')).toEqual(['q-act1-bishop']);
    expect(questStatus(s, 'q-act1-bishop')).toBe('completed');
  });

  it('cannot complete a quest twice', () => {
    const s = makeQuestState();
    activateQuest(s, 'q-act1-relic');
    onRarePickup(s);
    expect(onRarePickup(s)).toEqual([]); // already completed
  });

  it('quest data is well-formed (count > 0, ordered)', () => {
    expect(questDef('q-intro-descend')).toBeDefined();
    expect(questDef('q-act1-bones')!.objective.count).toBe(3);
    expect(questDef('q-act1-bishop')!.order).toBe(3);
  });
});
