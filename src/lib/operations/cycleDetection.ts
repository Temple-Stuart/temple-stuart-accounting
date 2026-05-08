/**
 * Cycle detection for the operations_project_dependencies graph.
 *
 * Pure function — no DB access, no side effects. Takes a precomputed
 * adjacency map and returns whether adding a proposed edge would create
 * a cycle.
 *
 * Used only for `blocks`-typed edges (PR-Ops-3c, β). Advisory edges
 * (informs, derived_from) skip cycle detection because mutual cross-
 * reference is a legitimate semantic for them. Only `blocks` is a strict
 * acyclic ordering constraint.
 *
 * Algorithm: iterative DFS from the proposed target. If the search
 * reaches the proposed source, the new edge would close a cycle.
 * Visited Set prevents infinite loops in pre-existing (legitimate by
 * being non-blocks, but theoretically possible if data was inserted
 * raw) cycle data.
 *
 * Complexity: O(V + E) where V = projects, E = blocks edges. At
 * single-user scale (≤200 projects per recon), trivially fast.
 *
 * Extracted from API route handler so it can be:
 *   1. Tested in isolation
 *   2. Reused by the priority engine (PR-Ops-4) for topological sort
 *   3. Reasoned about without auth/Prisma context noise
 */

export interface DependencyEdge {
  project_id: string;
  depends_on_project_id: string;
}

/**
 * Build adjacency map from a flat edge list.
 * adj[X] = list of project IDs that X "blocks" (i.e., X depends on them
 * in the sense "X cannot complete until those are done").
 *
 * In the schema: `project_id blocks depends_on_project_id` means project_id
 * is the source and depends_on_project_id is the prerequisite. So the
 * adjacency from a project's perspective is "this project's prerequisites".
 */
export function buildAdjacency(edges: DependencyEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.project_id)) adj.set(e.project_id, []);
    adj.get(e.project_id)!.push(e.depends_on_project_id);
  }
  return adj;
}

/**
 * Returns true if adding edge (sourceId → targetId) to the existing graph
 * would create a cycle.
 *
 * Logic: a cycle exists iff `targetId` can already reach `sourceId` via
 * existing edges. If so, adding sourceId → targetId closes the loop.
 *
 * @param adj   Pre-built adjacency map (from buildAdjacency).
 * @param sourceId   Proposed edge source (the project that will "block on" target).
 * @param targetId   Proposed edge target (the prerequisite project).
 * @returns true if the edge would create a cycle, false otherwise.
 */
export function dfsHasCycle(
  adj: Map<string, string[]>,
  sourceId: string,
  targetId: string
): boolean {
  // Edge case: self-loop. DB CHECK rejects it, but defense-in-depth.
  if (sourceId === targetId) return true;

  const visited = new Set<string>();
  const stack: string[] = [targetId];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === sourceId) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const neighbors = adj.get(node);
    if (neighbors) {
      for (const next of neighbors) {
        if (!visited.has(next)) stack.push(next);
      }
    }
  }

  return false;
}
