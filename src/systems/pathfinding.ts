// A* on a 4-connected grid with uniform cost. Manhattan heuristic — admissible
// for 4-connected uniform-cost movement, so A* returns shortest paths.
//
// Pure data + functions; no Pixi imports. The walkable test is supplied by
// the caller so this works against any grid (procgen DungeonMap or future
// hand-authored levels).

export interface PathTile {
  readonly tx: number;
  readonly ty: number;
}

export interface PathfindGrid {
  readonly w: number;
  readonly h: number;
  isWalkable(tx: number, ty: number): boolean;
}

interface Node {
  readonly tx: number;
  readonly ty: number;
  g: number;       // cost from start
  f: number;       // g + heuristic
  parent: Node | null;
  closed: boolean;
}

// Returns the path from `start` to `goal` inclusive, or null if no route
// exists / start == goal handled with a single-element path.
//
// Uses a flat array as the open set with linear-scan pop. For the dungeon
// sizes we ship through v0.5.0 (≤ 64×64 ≈ 4k nodes) the open set rarely
// exceeds ~50 entries — a heap would not measurably help.
export function findPath(
  grid: PathfindGrid,
  start: PathTile,
  goal: PathTile,
): PathTile[] | null {
  if (!grid.isWalkable(start.tx, start.ty)) return null;
  if (!grid.isWalkable(goal.tx, goal.ty)) return null;
  if (start.tx === goal.tx && start.ty === goal.ty) {
    return [{ tx: start.tx, ty: start.ty }];
  }

  // Pre-allocate the node grid so we can deduplicate by coordinate.
  const nodes: (Node | undefined)[] = new Array<Node | undefined>(grid.w * grid.h);
  const idx = (x: number, y: number): number => y * grid.w + x;

  const startNode: Node = {
    tx: start.tx,
    ty: start.ty,
    g: 0,
    f: heuristic(start, goal),
    parent: null,
    closed: false,
  };
  nodes[idx(start.tx, start.ty)] = startNode;

  const open: Node[] = [startNode];
  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];

  while (open.length > 0) {
    // Pop lowest-f node.
    let bestIx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bestIx]!.f) bestIx = i;
    }
    const current = open[bestIx]!;
    open.splice(bestIx, 1);
    current.closed = true;

    if (current.tx === goal.tx && current.ty === goal.ty) {
      return reconstruct(current);
    }

    for (let i = 0; i < 4; i++) {
      const nx = current.tx + dx[i]!;
      const ny = current.ty + dy[i]!;
      if (nx < 0 || ny < 0 || nx >= grid.w || ny >= grid.h) continue;
      if (!grid.isWalkable(nx, ny)) continue;

      const ni = idx(nx, ny);
      const tentativeG = current.g + 1;
      const existing = nodes[ni];
      if (existing) {
        if (existing.closed) continue;
        if (tentativeG >= existing.g) continue;
        existing.g = tentativeG;
        existing.f = tentativeG + heuristic(existing, goal);
        existing.parent = current;
      } else {
        const neighbour: Node = {
          tx: nx,
          ty: ny,
          g: tentativeG,
          f: tentativeG + heuristic({ tx: nx, ty: ny }, goal),
          parent: current,
          closed: false,
        };
        nodes[ni] = neighbour;
        open.push(neighbour);
      }
    }
  }
  return null;
}

function heuristic(a: PathTile, b: PathTile): number {
  return Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);
}

function reconstruct(end: Node): PathTile[] {
  const path: PathTile[] = [];
  let cur: Node | null = end;
  while (cur) {
    path.push({ tx: cur.tx, ty: cur.ty });
    cur = cur.parent;
  }
  path.reverse();
  return path;
}
