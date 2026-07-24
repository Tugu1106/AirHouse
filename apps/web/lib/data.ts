import { listItems, listBranches, listEmployees, type ItemWithRelations } from '@airlink/core';
import type { Branch, Employee } from '@airlink/core';
import { getCurrentUserEmail } from './auth';

// The single payload the whole authed app renders from. Loaded once server-side
// (in the (app) layout) and refreshed client-side only after a write. Includes
// soft-deleted items so the "show deleted" toggle works without a refetch.
export interface DataBundle {
  items: ItemWithRelations[];
  branches: Branch[];
  employees: Employee[];
  userEmail: string | null;
}

export async function loadDataBundle(): Promise<DataBundle> {
  const [items, branches, employees, userEmail] = await Promise.all([
    listItems({ includeDeleted: true, sortBy: 'created_at', sortDir: 'desc' }),
    listBranches(),
    listEmployees(),
    getCurrentUserEmail(),
  ]);
  return { items, branches, employees, userEmail };
}
