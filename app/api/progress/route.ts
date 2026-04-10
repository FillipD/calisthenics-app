import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { NODES, NODE_MAP } from "@/lib/skillTree";

// ─── Tree helpers ─────────────────────────────────────────────────────────────

/** All ancestor node IDs walking toward root via parentId */
function getAncestors(nodeId: string): string[] {
  const ancestors: string[] = [];
  let node = NODE_MAP.get(nodeId);
  while (node?.parentId) {
    ancestors.push(node.parentId);
    node = NODE_MAP.get(node.parentId);
  }
  return ancestors;
}

/**
 * Returns true if `potentialAncestorId` appears anywhere in the parentId
 * chain of `nodeId` (i.e. nodeId is a descendant of potentialAncestorId).
 */
function isAncestorOf(potentialAncestorId: string, nodeId: string): boolean {
  let node = NODE_MAP.get(nodeId);
  while (node?.parentId) {
    if (node.parentId === potentialAncestorId) return true;
    node = NODE_MAP.get(node.parentId);
  }
  return false;
}

/**
 * Returns true if `nodeId` or any node in its subtree has a progress entry,
 * excluding nodes in the `excluding` set (nodes we are about to clear).
 */
function subtreeHasProgress(
  nodeId: string,
  excluding: Set<string>,
  progressMap: Record<string, string>
): boolean {
  if (!excluding.has(nodeId) && progressMap[nodeId]) return true;
  return NODES
    .filter(n => n.parentId === nodeId)
    .some(child => subtreeHasProgress(child.id, excluding, progressMap));
}

/**
 * Computes the full set of node IDs to remove when clearing `clearedNodeId`.
 *
 * Starts with the tapped node, then walks up the ancestor chain. For each
 * ancestor, checks whether any OTHER child branch of that ancestor still has
 * progress. If no sibling branch has progress, the ancestor's "completed"
 * entry is no longer needed and is added to the clear set. Stops as soon as
 * a sibling branch has progress.
 */
function computeClearSet(
  clearedNodeId: string,
  progressMap: Record<string, string>
): string[] {
  const toClear = new Set<string>([clearedNodeId]);
  let currentId = clearedNodeId;

  while (true) {
    const node = NODE_MAP.get(currentId);
    if (!node?.parentId) break;

    const ancestorId = node.parentId;

    // Check whether any sibling subtree (a branch not through currentId) still
    // has progress. If so, the ancestor's completed status is still valid.
    const siblingHasProgress = NODES
      .filter(n => n.parentId === ancestorId && n.id !== currentId)
      .some(sibling => subtreeHasProgress(sibling.id, toClear, progressMap));

    if (siblingHasProgress) break;

    toClear.add(ancestorId);
    currentId = ancestorId;
  }

  return Array.from(toClear);
}

// ─── Auth + profile helper ────────────────────────────────────────────────────
async function getProfile() {
  const user = await currentUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clerk_id", user.id)
    .single();
  return profile ?? null;
}

// ─── POST: set a node as current ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { nodeId, status } = await req.json() as { nodeId: string; status: string };
  if (!nodeId || status !== "current") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Fetch the user's current progress so we can find conflicts
  const { data: progressRows } = await supabaseAdmin
    .from("user_progress")
    .select("node_id, status")
    .eq("user_id", profile.id);

  const progressMap: Record<string, string> = {};
  for (const row of progressRows ?? []) progressMap[row.node_id] = row.status;

  // Find any existing "current" nodes that are descendants of nodeId.
  // These will become locked once nodeId is current, so clear them first.
  const descendantCurrentNodes = Object.keys(progressMap).filter(
    id => progressMap[id] === "current" && isAncestorOf(nodeId, id)
  );

  if (descendantCurrentNodes.length > 0) {
    await supabaseAdmin
      .from("user_progress")
      .delete()
      .eq("user_id", profile.id)
      .in("node_id", descendantCurrentNodes);
  }

  // Upsert nodeId as "current" and all its ancestors as "completed"
  const rows: { user_id: string; node_id: string; status: string }[] = [
    { user_id: profile.id, node_id: nodeId, status: "current" },
  ];
  for (const ancestorId of getAncestors(nodeId)) {
    rows.push({ user_id: profile.id, node_id: ancestorId, status: "completed" });
  }

  const { error } = await supabaseAdmin
    .from("user_progress")
    .upsert(rows, { onConflict: "user_id,node_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cleared: descendantCurrentNodes });
}

// ─── DELETE: clear a node and any now-orphaned ancestor completions ───────────
export async function DELETE(req: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { nodeId } = await req.json() as { nodeId: string };
  if (!nodeId) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  // Fetch current progress to evaluate the ancestor walk
  const { data: progressRows } = await supabaseAdmin
    .from("user_progress")
    .select("node_id, status")
    .eq("user_id", profile.id);

  const progressMap: Record<string, string> = {};
  for (const row of progressRows ?? []) progressMap[row.node_id] = row.status;

  // Compute the full set of nodes to remove
  const toClear = computeClearSet(nodeId, progressMap);

  const { error } = await supabaseAdmin
    .from("user_progress")
    .delete()
    .eq("user_id", profile.id)
    .in("node_id", toClear);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cleared: toClear });
}
