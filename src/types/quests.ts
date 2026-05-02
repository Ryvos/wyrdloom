// Quest types — shape of `data/quests.json` entries.
// Discriminated union on `objective.kind` so adding a new objective type
// fails the build at every consumer that doesn't handle it.

export type QuestObjective =
  | { kind: 'enter_zone'; zone: string; count: number }
  | { kind: 'kill_count'; zone: string; count: number }
  | { kind: 'rare_pickup'; count: number }
  | { kind: 'boss_kill'; bossId: string; count: number };

export interface QuestDef {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly objective: QuestObjective;
  readonly reward: string;
  readonly act: number;
  readonly main: boolean;
  readonly order: number;
}

export interface QuestFile {
  readonly quests: ReadonlyArray<QuestDef>;
}

export type QuestStatus = 'inactive' | 'active' | 'completed';

export interface QuestProgress {
  readonly id: string;
  status: QuestStatus;
  current: number; // running count toward `objective.count`
}
