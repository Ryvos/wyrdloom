// Zone abstraction — what kind of map are we in, and how do we transition.
// v0.6.0 ships two: 'whitestone' (hand-authored hub) + 'catacombs' (BSP procgen).
// Future biomes (frostvein, ruined-keep, blood-cathedral) drop in as new
// ZoneId entries + their own loader.
//
// The zone holds the map + the actor placement rules + a doorway list.
// Doorways are floor tiles tagged with a target zone — stepping on one queues
// a transition.

import type { DungeonMap } from './procgen';

export const ZONES = ['whitestone', 'catacombs', 'frostvein', 'cinderfall'] as const;
export type ZoneId = (typeof ZONES)[number];

export interface DoorwayTile {
  readonly tx: number;
  readonly ty: number;
  readonly target: ZoneId;
  readonly label: string; // shown in the world hint when nearby
}

export interface Zone {
  readonly id: ZoneId;
  readonly map: DungeonMap;
  readonly playerEntry: { tx: number; ty: number };
  readonly doorways: ReadonlyArray<DoorwayTile>;
  // Where to place the player when *coming from* a specific source zone.
  // If a zone has only one doorway, the entry is `playerEntry`. The hub has
  // multiple potential return points (one per dungeon entrance).
  readonly entryFromZone?: Partial<Record<ZoneId, { tx: number; ty: number }>>;
}

export function isDoorway(zone: Zone, tx: number, ty: number): DoorwayTile | undefined {
  return zone.doorways.find((d) => d.tx === tx && d.ty === ty);
}
