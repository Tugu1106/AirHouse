import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
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

const ITEM_ICON: Record<string, string> = {
  desktop: '🖥️',
  laptop: '💻',
  monitor: '🖥️',
  mouse: '🖱️',
  keyboard: '⌨️',
  printer: '🖨️',
  cable: '🔌',
  lan_switch: '🌐',
};

const ITEM_STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  in_repair: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  retired: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  lost: 'bg-red-500/15 text-red-300 ring-red-500/30',
};

// Colour of the timeline node per event kind.
const NODE_DOT: Record<string, string> = {
  create: 'bg-emerald-500',
  assign: 'bg-sky-500',
  transfer: 'bg-sky-500',
  update: 'bg-amber-500',
  soft_delete: 'bg-red-500',
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

  // A short identifier — no full spec sheet, just enough to know which unit.
  const mainName =
    [item.properties.model, item.properties.system_name, item.properties.serial]
      .filter(Boolean)
      .map(String)
      .join(' · ') || '—';

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
    <main className="mx-auto max-w-2xl space-y-4 px-6 py-6">
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

      <section className="panel animate-rise overflow-hidden">
        {/* Hero */}
        <div className="border-b border-slate-800 bg-gradient-to-br from-brand/10 via-transparent to-transparent p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-2xl ring-1 ring-slate-700/60">
              {ITEM_ICON[item.type] ?? '📦'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-semibold text-white">{def?.label ?? item.type}</h1>
                {item.deleted_at && (
                  <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300 ring-1 ring-red-500/30">
                    deleted
                  </span>
                )}
              </div>
              {mainName && <p className="truncate text-sm text-slate-400">{mainName}</p>}
              <span className="mt-2 inline-block rounded-md bg-slate-800/80 px-2 py-0.5 font-mono text-xs tracking-widest text-slate-400 ring-1 ring-slate-700">
                {assetTag}
              </span>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                ITEM_STATUS_STYLE[item.status] ?? ITEM_STATUS_STYLE.retired
              }`}
            >
              {item.status.replace('_', ' ')}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/60 px-3 py-1.5 text-xs ring-1 ring-slate-700/60">
              <span className="text-slate-500">Branch</span>
              <span className="font-medium text-slate-200">{item.branch?.name ?? '—'}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/60 px-3 py-1.5 text-xs ring-1 ring-slate-700/60">
              <span className="text-slate-500">Assigned</span>
              <span className="font-medium text-slate-200">{item.assignee?.name ?? 'Unassigned'}</span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-300">History</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-500">No history yet.</p>
          ) : (
            <ol>
              {timeline.map((node, idx) => {
                const last = idx === timeline.length - 1;
                const { kind, entry } = node;
                return (
                  <li key={node.key} className="flex gap-4">
                    {/* node + connector */}
                    <div className="flex flex-col items-center">
                      <span
                        className={`mt-1 h-4 w-4 shrink-0 rounded-full ring-4 ring-slate-900 ${
                          NODE_DOT[kind] ?? 'bg-slate-500'
                        }`}
                      />
                      {!last && <span className="w-px flex-1 bg-slate-800" />}
                    </div>
                    {/* content */}
                    <div className={last ? 'pb-1' : 'pb-6'}>
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
                        <div className="text-sm text-slate-400">
                          {assigneeText(entry.from_employee_id, entry.to_employee_id, empName)}
                          {(entry.diff as { reason?: string } | null)?.reason ===
                            'employee_deleted' && (
                            <span className="ml-2 rounded bg-red-500/15 px-1.5 py-0.5 text-[11px] font-medium text-red-300 ring-1 ring-red-500/30">
                              employee deleted
                            </span>
                          )}
                        </div>
                      )}
                      {kind === 'transfer' && (entry.from_branch_id || entry.to_branch_id) && (
                        <div className="text-sm text-slate-400">
                          Branch: {branchName(entry.from_branch_id)} → {branchName(entry.to_branch_id)}
                        </div>
                      )}
                      {kind === 'update' && <UpdateChanges diff={entry.diff} def={def} />}
                      <div className="mt-0.5 text-xs text-slate-500">{fmt(entry.created_at)}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </main>
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
  if (changes.length === 0)
    return <p className="mt-1 text-sm text-slate-500">No visible changes.</p>;
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
