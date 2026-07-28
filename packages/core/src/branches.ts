// Branch read/create helpers.

import { getServiceClient } from "./supabaseClient";
import type { Branch, UUID } from "./types";

export async function listBranches(): Promise<Branch[]> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("branches")
    .select("*")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Branch[];
}

export async function getBranch(id: UUID): Promise<Branch | null> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("branches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Branch) ?? null;
}

/**
 * Resolve a branch by (case-insensitive) name. Throws a clear error if there is
 * no match or more than one — used by the MCP tools so Claude can pass names.
 */
export async function findBranchByName(name: string): Promise<Branch> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("branches")
    .select("*")
    .ilike("name", name.trim());
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Branch[];
  if (rows.length === 0) throw new Error(`No branch named "${name}".`);
  if (rows.length > 1) {
    throw new Error(
      `"${name}" matches multiple branches: ${rows.map((b) => b.name).join(", ")}.`,
    );
  }
  return rows[0]!;
}

export async function createBranch(name: string): Promise<Branch> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("branches")
    .insert({ name })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Branch;
}

/** Make one branch the central/HQ branch, clearing the flag from all others. */
export async function setBranchAsHq(id: UUID): Promise<void> {
  const client = getServiceClient();
  const { error: clearErr } = await client
    .from("branches")
    .update({ is_hq: false })
    .neq("id", id);
  if (clearErr) throw new Error(clearErr.message);
  const { error: setErr } = await client
    .from("branches")
    .update({ is_hq: true })
    .eq("id", id);
  if (setErr) throw new Error(setErr.message);
}

export interface UpdateBranchInput {
  name?: string;
  branchNo?: string | null;
  distanceHq?: string | null;
}

export async function updateBranch(
  id: UUID,
  patch: UpdateBranchInput,
): Promise<Branch> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.branchNo !== undefined) update.branch_no = patch.branchNo;
  if (patch.distanceHq !== undefined) update.distance_hq = patch.distanceHq;

  const client = getServiceClient();
  const { data, error } = await client
    .from("branches")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Branch;
}

/**
 * Hard-delete a branch — allowed only when nothing references it (items point at
 * a branch via a NOT NULL FK, so a non-empty branch cannot be removed safely).
 *
 *
 */
export async function deleteBranch(id: UUID): Promise<void> {
  const client = getServiceClient();

  const { count: itemCount, error: iErr } = await client
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("branch_id", id);
  if (iErr) throw new Error(iErr.message);
  if ((itemCount ?? 0) > 0) {
    throw new Error(
      "Cannot delete: this branch still has items. Move or remove them first.",
    );
  }

  const { count: empCount, error: eErr } = await client
    .from("employees")
    .select("*", { count: "exact", head: true })
    .eq("branch_id", id);
  if (eErr) throw new Error(eErr.message);
  if ((empCount ?? 0) > 0) {
    throw new Error(
      "Cannot delete: this branch still has employees. Reassign them first.",
    );
  }

  const { error } = await client.from("branches").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Save a branch's position on the custom map view (fractions 0..1). */
export async function updateBranchPosition(
  id: UUID,
  mapX: number,
  mapY: number,
): Promise<Branch> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("branches")
    .update({ map_x: mapX, map_y: mapY })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Branch;
}

/** Item counts per branch (live items only) — used by the dashboard cards. */
export async function branchItemCounts(): Promise<Record<UUID, number>> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("items")
    .select("branch_id")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  const counts: Record<UUID, number> = {};
  for (const row of (data ?? []) as { branch_id: UUID }[]) {
    counts[row.branch_id] = (counts[row.branch_id] ?? 0) + 1;
  }
  return counts;
}
