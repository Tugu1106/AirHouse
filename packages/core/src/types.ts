// Shared database row types + common enums for the Airlink asset tracker.

export type UUID = string;

export type ItemStatus = 'active' | 'in_repair' | 'retired' | 'lost';

export const ITEM_STATUSES: ItemStatus[] = ['active', 'in_repair', 'retired', 'lost'];

export type AuditAction = 'create' | 'update' | 'soft_delete' | 'hard_delete' | 'transfer';

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

export type EmployeeStatus = 'active' | 'trial' | 'pregnancy_leave' | 'fired';

export const EMPLOYEE_STATUSES: { key: EmployeeStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'trial', label: 'Trial' },
  { key: 'pregnancy_leave', label: 'Pregnancy leave' },
  { key: 'fired', label: 'Fired' },
];

// Sectors (departments) and the positions within each — the ONE source of
// truth. Order matters and is preserved as written. The Position dropdown
// cascades from the chosen Sector via positionsForSector().
export const SECTOR_POSITIONS: { sector: string; positions: string[] }[] = [
  { sector: 'Байгууллага хариуцсан нэгж', positions: ['Тийз захиалгын ажилтан', 'Билет бичигч'] },
  { sector: 'Удирдлага', positions: ['Гүйцэтгэх захирал', 'Дэд захирал'] },
  {
    sector: 'Борлуулалт, үйлчилгээний алба',
    positions: [
      'Борлуулалт, үйлчилгээний албаны дарга',
      'Маркетингийн менежер',
      'Онлайн борлуулалтын менежер /ECommerce/',
      'Программ хангамж хөгжүүлэгч',
    ],
  },
  {
    sector: 'Санхүү бүртгэлийн алба',
    positions: [
      'Ерөнхий нягтлан бодогч',
      'Ахлах нягтлан бодогч',
      'Санхүүгийн шинжээч',
      'Нягтлан бодогч',
    ],
  },
  { sector: 'Хүний нөөцийн алба', positions: ['Хүний нөөцийн мэргэжилтэн'] },
];

export const EMPLOYEE_SECTORS: { key: string; label: string }[] = SECTOR_POSITIONS.map((s) => ({
  key: s.sector,
  label: s.sector,
}));

// Flat list of every position (used when no sector is chosen, and for filters).
export const EMPLOYEE_POSITIONS: { key: string; label: string }[] = SECTOR_POSITIONS.flatMap((s) =>
  s.positions.map((p) => ({ key: p, label: p })),
);

/** Default when a position isn't specified (e.g. MCP) — none, since positions
 *  depend on the chosen sector. */
export const DEFAULT_POSITION = '';

/** Positions belonging to a sector; all positions if none/unknown given. */
export function positionsForSector(sector: string | null | undefined): { key: string; label: string }[] {
  const found = SECTOR_POSITIONS.find((s) => s.sector === sector);
  const list = found ? found.positions : SECTOR_POSITIONS.flatMap((s) => s.positions);
  return list.map((p) => ({ key: p, label: p }));
}

/** The only sector available outside the HQ (downtown) branch. */
export const NON_HQ_SECTOR = SECTOR_POSITIONS[0]?.sector ?? '';

/** Sectors available at a branch: all at HQ, only NON_HQ_SECTOR elsewhere. */
export function sectorsForBranch(isHq: boolean): { key: string; label: string }[] {
  return isHq ? EMPLOYEE_SECTORS : EMPLOYEE_SECTORS.filter((s) => s.key === NON_HQ_SECTOR);
}

export interface Employee {
  id: UUID;
  name: string;
  branch_id: UUID | null;
  active: boolean;
  phone: string | null;
  position: string | null;
  /** Department/sector (fixed dropdown). */
  sector: string | null;
  status: EmployeeStatus;
  /** Work email used for self-service login (null = no login). */
  email: string | null;
  /** Supabase Auth user id, set once their login is provisioned. */
  user_id: string | null;
  /** Soft-delete marker; null = active. Kept so item history resolves their name. */
  deleted_at: string | null;
  /** Manual "Custom" order within a branch (null = unset, sorts last). */
  sort_order: number | null;
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
  /** Manual "Custom" order within a branch (null = unset, sorts last). */
  sort_order: number | null;
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
  /** Source marker for the Log: 'ai' (assistant) or 'scan' (self-registration). */
  via?: 'ai' | 'scan';
}
