import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import {
  Monitor,
  Laptop,
  Mouse,
  Keyboard,
  Printer,
  Cable,
  Network,
  Package,
  MapPin,
  User,
  Tag,
  Plus,
  ArrowLeftRight,
  Pencil,
  Trash2,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  getItemWithRelations,
  listAuditForItem,
  listBranches,
  listEmployees,
  getItemType,
} from '@airlink/core';
import { BackButton } from '@/components/BackButton';
import { ItemActions } from '@/components/ItemActions';
import { scanUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';

const fmt = (iso: string) => new Date(iso).toLocaleString();

const ITEM_ICON: Record<string, LucideIcon> = {
  desktop: Monitor,
  laptop: Laptop,
  monitor: Monitor,
  mouse: Mouse,
  keyboard: Keyboard,
  printer: Printer,
  cable: Cable,
  lan_switch: Network,
};

const ITEM_STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  in_repair: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  retired: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  lost: 'bg-red-500/15 text-red-300 ring-red-500/30',
};

const NODE: Record<string, { icon: LucideIcon; cls: string }> = {
  create: { icon: Plus, cls: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/30' },
  assign: { icon: UserCheck, cls: 'text-sky-300 bg-sky-500/10 ring-sky-500/30' },
  transfer: { icon: ArrowLeftRight, cls: 'text-sky-300 bg-sky-500/10 ring-sky-500/30' },
  update: { icon: Pencil, cls: 'text-amber-300 bg-amber-500/10 ring-amber-500/30' },
  soft_delete: { icon: Trash2, cls: 'text-red-300 bg-red-500/10 ring-red-500/30' },
};

type TimelineKind = 'create' | 'assign' | 'transfer' | 'update' | 'soft_delete';

export default async function ItemHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItemWithRelations(id);
  if (!item) notFound();

  const [audit, branches, employees] = await Promise.all([
    listAuditForItem(id),
    listBranches(),
    listEmployees(undefined, true), // include deleted so history resolves their name
  ]);

  const branchName = (bid: string | null) => branches.find((b) => b.id === bid)?.name ?? '—';
  const empName = (eid: string | null) => employees.find((e) => e.id === eid)?.name ?? '—';
  const def = getItemType(item.type);
  const qrSvg = await QRCode.toString(scanUrl(id), { type: 'svg', margin: 0, width: 200 });
  const assetTag = `AIR-${id.slice(0, 8).toUpperCase()}`;
  const Icon = ITEM_ICON[item.type] ?? Package;

  const str = (v: unknown) => (v == null || v === '' ? null : String(v));
  const mainName = str(item.properties.model) ?? str(item.properties.system_name) ?? str(item.properties.serial);
  const specs = (def?.fields ?? []).map((f) => ({
    label: f.label,
    value: str(item.properties[f.key]) ?? '—',
  }));

  // Build a chronological (oldest → newest) timeline. A create-with-owner
  // expands into two nodes: "Item created" then "Assigned to <first owner>".
  type Entry = (typeof audit)[number];
  const timeline: { key: string; kind: TimelineKind; entry: Entry }[] = [];
  for (const entry of [...audit].reverse()) {
    if (entry.action === 'create') {
      timeline.push({ key: `${entry.id}:create`, kind: 'create', entry });
      if (entry.to_employee_id) {
        timeline.push({ key: `${entry.id}:assign`, kind: 'assign', entry });
      }
    } else {
      timeline.push({ key: entry.id, kind: entry.action as TimelineKind, entry });
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton />
        <ItemActions
          item={item}
          branches={branches}
          employees={employees.filter((e) => !e.deleted_at)}
          qrSvg={qrSvg}
          scanLink={scanUrl(id)}
        />
      </div>

      {/* Overview */}
      <section className="panel animate-rise p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300">
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-white">{def?.label ?? item.type}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${
                  ITEM_STATUS_STYLE[item.status] ?? ITEM_STATUS_STYLE.retired
                }`}
              >
                {item.status.replace('_', ' ')}
              </span>
              {item.deleted_at && (
                <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-300 ring-1 ring-red-500/30">
                  deleted
                </span>
              )}
            </div>
            {mainName && <p className="mt-0.5 truncate text-sm text-slate-400">{mainName}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              <Meta icon={Tag} mono>
                {assetTag}
              </Meta>
              <Meta icon={MapPin}>{item.branch?.name ?? '—'}</Meta>
              <Meta icon={User}>{item.assignee?.name ?? 'Unassigned'}</Meta>
            </div>
          </div>
        </div>
      </section>

      {/* Specifications */}
      {specs.length > 0 && (
        <section className="panel p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Specifications</h2>
          <dl className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
            {specs.map((s) => (
              <div key={s.label} className="flex flex-col gap-0.5 border-b border-slate-800/70 pb-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {s.label}
                </dt>
                <dd className="break-words text-sm font-medium text-slate-100">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* History */}
      <section className="panel p-6">
        <h2 className="mb-5 text-sm font-semibold text-slate-200">History</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500">No history yet.</p>
        ) : (
          <ol>
            {timeline.map((node, idx) => {
              const last = idx === timeline.length - 1;
              const { kind, entry } = node;
              const n = NODE[kind] ?? {
                icon: Pencil,
                cls: 'text-slate-300 bg-slate-500/10 ring-slate-500/30',
              };
              const NodeIcon = n.icon;
              return (
                <li key={node.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ${n.cls}`}
                    >
                      <NodeIcon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    {!last && <span className="w-px flex-1 bg-slate-800" />}
                  </div>

                  <div className={`min-w-0 flex-1 pt-1 ${last ? 'pb-1' : 'pb-6'}`}>
                    {kind === 'assign' ? (
                      <>
                        <div className="text-sm font-medium text-slate-100">
                          Assigned to {empName(entry.to_employee_id)}
                        </div>
                        <div className="text-xs text-slate-500">First owner</div>
                      </>
                    ) : (
                      <div className="text-sm font-medium text-slate-100">
                        {describe(kind)}
                        {entry.actor_email && (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            by {entry.actor_email}
                          </span>
                        )}
                      </div>
                    )}

                    {kind === 'transfer' && (entry.from_employee_id || entry.to_employee_id) && (
                      <div className="mt-0.5 text-sm text-slate-400">
                        {assigneeText(entry.from_employee_id, entry.to_employee_id, empName)}
                        {(entry.diff as { reason?: string } | null)?.reason === 'employee_deleted' && (
                          <span className="ml-2 rounded bg-red-500/15 px-1.5 py-0.5 text-[11px] font-medium text-red-300 ring-1 ring-red-500/30">
                            employee deleted
                          </span>
                        )}
                      </div>
                    )}
                    {kind === 'transfer' && (entry.from_branch_id || entry.to_branch_id) && (
                      <div className="mt-0.5 text-sm text-slate-400">
                        Branch: {branchName(entry.from_branch_id)} → {branchName(entry.to_branch_id)}
                      </div>
                    )}
                    {kind === 'update' && <UpdateChanges diff={entry.diff} def={def} />}
                    <div className="mt-1 text-xs text-slate-500">{fmt(entry.created_at)}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}

function Meta({
  icon: Icon,
  mono,
  children,
}: {
  icon: LucideIcon;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-slate-700/70 bg-slate-800/40 px-2.5 py-1 text-xs text-slate-300 ${
        mono ? 'font-mono tracking-wide' : ''
      }`}
    >
      <Icon className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} />
      {children}
    </span>
  );
}

function assigneeText(
  from: string | null,
  to: string | null,
  name: (id: string | null) => string,
): string {
  if (!from && to) return `Assigned to ${name(to)}`;
  if (from && !to) return `Unassigned from ${name(from)}`;
  if (from && to) return `Reassigned: ${name(from)} → ${name(to)}`;
  return '';
}

function describe(action: string): string {
  switch (action) {
    case 'create':
      return 'Item created';
    case 'update':
      return 'Item updated';
    case 'soft_delete':
      return 'Item deleted';
    case 'transfer':
      return 'Item transferred';
    default:
      return action;
  }
}

function humanizeKey(key: string): string {
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Turn a shallow update diff ({ status?: {from,to}, properties?: {from,to} })
// into a list of readable field changes.
function changeList(
  diff: unknown,
  def: ReturnType<typeof getItemType>,
): { label: string; from: string; to: string }[] {
  const d = diff as Record<string, { from?: unknown; to?: unknown }> | null;
  if (!d || typeof d !== 'object') return [];
  const val = (v: unknown) => (v == null || v === '' ? '—' : String(v));
  const labelFor = (key: string) => def?.fields.find((f) => f.key === key)?.label ?? humanizeKey(key);
  const out: { label: string; from: string; to: string }[] = [];

  if (d.status) out.push({ label: 'Status', from: val(d.status.from), to: val(d.status.to) });

  if (d.properties) {
    const from = (d.properties.from ?? {}) as Record<string, unknown>;
    const to = (d.properties.to ?? {}) as Record<string, unknown>;
    for (const k of new Set([...Object.keys(from), ...Object.keys(to)])) {
      if (val(from[k]) === val(to[k])) continue;
      out.push({ label: labelFor(k), from: val(from[k]), to: val(to[k]) });
    }
  }
  return out;
}

function UpdateChanges({ diff, def }: { diff: unknown; def: ReturnType<typeof getItemType> }) {
  const changes = changeList(diff, def);
  if (changes.length === 0) return <p className="mt-1 text-sm text-slate-500">No visible changes.</p>;
  return (
    <ul className="mt-1 space-y-0.5">
      {changes.map((c, i) => (
        <li key={i} className="text-sm text-slate-400">
          <span className="font-medium text-slate-300">{c.label}</span> changed from{' '}
          <span className="text-slate-300">“{c.from}”</span> to{' '}
          <span className="text-slate-300">“{c.to}”</span>
        </li>
      ))}
    </ul>
  );
}
