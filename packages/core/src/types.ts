// Shared database row types + common enums for the Airlink asset tracker.

export type UUID = string;

export type ItemStatus = 'active' | 'in_repair' | 'retired' | 'lost';

export const ITEM_STATUSES: ItemStatus[] = ['active', 'in_repair', 'retired', 'lost'];

export type AuditAction = 'create' | 'update' | 'soft_delete' | 'transfer';

export interface Branch {
  id: UUID;
  name: string;
  /** Position on the map view, stored as lng (map_x) / lat (map_y). */
  map_x: number | null;
  map_y: number | null;
  /** The single central/HQ branch (shown centrally + badged in the maps). */
  is_hq: boolean;
  /** Custom admin-entered fields. */
  branch_no: string | null;
  distance_hq: string | null;
  created_at: string;
}

export type EmployeeStatus =
  | 'active'
  | 'newly_hired'
  | 'on_leave'
  | 'pregnancy_leave'
  | 'fired'
  | 'resigned';

export const EMPLOYEE_STATUSES: { key: EmployeeStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'newly_hired', label: 'Newly hired' },
  { key: 'on_leave', label: 'On leave / rest' },
  { key: 'pregnancy_leave', label: 'Pregnancy leave' },
  { key: 'fired', label: 'Fired' },
  { key: 'resigned', label: 'Resigned' },
];

// Predefined job positions — add new ones here (the web form reads this list).
export const EMPLOYEE_POSITIONS: { key: string; label: string }[] = [
  { key: 'developer', label: 'Developer' },
  { key: 'agent', label: 'Agent' },
  { key: 'finance', label: 'Finance' },
  { key: 'supervisor', label: 'Supervisor' },
];

export interface Employee {
  id: UUID;
  name: string;
  branch_id: UUID | null;
  active: boolean;
  phone: string | null;
  position: string | null;
  status: EmployeeStatus;
  /** Work email used for self-service login (null = no login). */
  email: string | null;
  /** Supabase Auth user id, set once their login is provisioned. */
  user_id: string | null;
  created_at: string;
}

export interface Item {
  id: UUID;
  type: string;
  branch_id: UUID;
  assigned_to: UUID | null;
  properties: Record<string, unknown>;
  status: ItemStatus;
  deleted_at: string | null;
  created_by: UUID;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: UUID;
  item_id: UUID;
  action: AuditAction;
  actor: UUID;
  from_branch_id: UUID | null;
  to_branch_id: UUID | null;
  from_employee_id: UUID | null;
  to_employee_id: UUID | null;
  diff: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Every mutating core function requires the id of the user performing the
 * action. In v1 this is always the single admin; it is written to
 * items.created_by and audit_log.actor so worker-account attribution works
 * later with no schema change.
 */
export interface ActorContext {
  actorId: UUID;
}
