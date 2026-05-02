// Quest state + progress logic. Pure functions. The game loop calls the
// `on*` event handlers; they advance + mark complete; the tracker panel
// reads QuestState and re-renders.
//
// State shape is small (id + status + current count per quest) so it
// serializes trivially into the SaveAdapter.

import questDataRaw from '@data/quests.json';
import type { QuestDef, QuestFile, QuestProgress, QuestStatus } from '../types/quests';

const QUEST_DATA = questDataRaw as QuestFile;

export function allQuestDefs(): ReadonlyArray<QuestDef> {
  return QUEST_DATA.quests;
}

export function questDef(id: string): QuestDef | undefined {
  return QUEST_DATA.quests.find((q) => q.id === id);
}

export interface QuestState {
  readonly progress: Record<string, QuestProgress>;
}

export function makeQuestState(): QuestState {
  // Auto-activate the very first main quest. Players never have to "accept"
  // the intro — it's available the moment the game boots.
  const firstMain = QUEST_DATA.quests.find((q) => q.main && q.order === 0);
  const progress: Record<string, QuestProgress> = {};
  if (firstMain) {
    progress[firstMain.id] = { id: firstMain.id, status: 'active', current: 0 };
  }
  return { progress };
}

// Activate a quest by id (used by Quest-board interactions). No-op if the
// quest is unknown or already active/completed.
export function activateQuest(state: QuestState, id: string): boolean {
  const def = questDef(id);
  if (!def) return false;
  const p = state.progress[id];
  if (p && p.status !== 'inactive') return false;
  state.progress[id] = { id, status: 'active', current: 0 };
  return true;
}

// Mark complete + return whether anything changed.
export function completeQuest(state: QuestState, id: string): boolean {
  const p = state.progress[id];
  if (!p || p.status === 'completed') return false;
  p.status = 'completed';
  return true;
}

export function questStatus(state: QuestState, id: string): QuestStatus {
  return state.progress[id]?.status ?? 'inactive';
}

// Each event handler walks active quests and advances any whose objective
// matches. Returns the ids of quests whose status flipped to 'completed'.
function tickObjective(state: QuestState, match: (def: QuestDef) => boolean): string[] {
  const completed: string[] = [];
  for (const def of QUEST_DATA.quests) {
    const p = state.progress[def.id];
    if (!p || p.status !== 'active') continue;
    if (!match(def)) continue;
    p.current = Math.min(def.objective.count, p.current + 1);
    if (p.current >= def.objective.count) {
      p.status = 'completed';
      completed.push(def.id);
    }
  }
  return completed;
}

export function onEnterZone(state: QuestState, zone: string): string[] {
  return tickObjective(state, (def) =>
    def.objective.kind === 'enter_zone' && def.objective.zone === zone,
  );
}

export function onEnemyKilled(state: QuestState, zone: string): string[] {
  return tickObjective(state, (def) =>
    def.objective.kind === 'kill_count' && def.objective.zone === zone,
  );
}

export function onBossKilled(state: QuestState, bossId: string): string[] {
  return tickObjective(state, (def) =>
    def.objective.kind === 'boss_kill' && def.objective.bossId === bossId,
  );
}

export function onRarePickup(state: QuestState): string[] {
  return tickObjective(state, (def) => def.objective.kind === 'rare_pickup');
}

// After a quest finishes, automatically activate the next main quest in
// `order`. Keeps the player moving without needing to revisit the board.
export function activateNextMainAfter(state: QuestState, completedId: string): string | null {
  const def = questDef(completedId);
  if (!def || !def.main) return null;
  const next = QUEST_DATA.quests
    .filter((q) => q.main && q.act === def.act && q.order === def.order + 1)
    .at(0);
  if (!next) return null;
  if (state.progress[next.id]?.status === 'active') return null;
  state.progress[next.id] = { id: next.id, status: 'active', current: 0 };
  return next.id;
}
