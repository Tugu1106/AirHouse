// Short-lived in-memory store for PC self-registration scans. A token is created
// when an employee starts a scan; their machine POSTs specs against that token;
// the browser polls and then confirms. Entries live ~15 min (a scan takes
// seconds), so losing them on a server restart is harmless — no DB table needed.

import { randomUUID } from 'crypto';

export interface ScanEntry {
  employeeId: string;
  actorId: string; // users.id, for audit attribution
  branchId: string | null;
  createdAt: number;
  specs?: Record<string, string>;
  itemType?: string; // 'desktop' | 'laptop'
}

const store = new Map<string, ScanEntry>();
const TTL_MS = 15 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [k, v] of store) if (now - v.createdAt > TTL_MS) store.delete(k);
}

export function createScan(entry: Omit<ScanEntry, 'createdAt'>): string {
  sweep();
  const token = randomUUID();
  store.set(token, { ...entry, createdAt: Date.now() });
  return token;
}

export function getScan(token: string): ScanEntry | undefined {
  sweep();
  return store.get(token);
}

export function setScanSpecs(
  token: string,
  specs: Record<string, string>,
  itemType: string,
): boolean {
  const e = store.get(token);
  if (!e) return false;
  e.specs = specs;
  e.itemType = itemType;
  return true;
}

export function deleteScan(token: string): void {
  store.delete(token);
}
