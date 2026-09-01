import { notFound } from 'next/navigation';
import {
  getItemWithRelations,
  listAuditForItem,
  listBranches,
  listEmployees,
  getItemType,
} from '@airlink/core';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';

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
      <div className="flex items-center justify-between">
        <BackButton />
        <Link
          href={`/label/${id}`}
          target="_blank"
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          🖨 Print label
        </Link>
      </div>

      <section className="panel p-6">
        {/* Compact item summary */}
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-800 text-xl">
            {ITEM_ICON[item.type] ?? '📦'}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-white">
              {def?.label ?? item.type}
              {item.deleted_at && <span className="ml-2 text-sm text-red-400">(deleted)</span>}
            </h1>
            <p className="truncate text-sm text-slate-400">{mainName}</p>
          </div>
          <span
            className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
              ITEM_STATUS_STYLE[item.status] ?? ITEM_STATUS_STYLE.retired
            }`}
          >
            {item.status.replace('_', ' ')}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
          <span>
            Branch: <span className="text-slate-300">{item.branch?.name ?? '—'}</span>
          </span>
          <span>
            Assigned: <span className="text-slate-300">{item.assignee?.name ?? 'Unassigned'}</span>
          </span>
        </div>

        {/* Timeline */}
        <div className="mt-6 border-t border-slate-800 pt-5">
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
                        <div className="text-sm font-medium text-slate-100">{describe(kind)}</div>
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
                      {kind === 'update' && entry.diff && (
                        <pre className="mt-1 overflow-x-auto rounded bg-slate-800/50 p-2 text-xs text-slate-400">
                          {JSON.stringify(entry.diff, null, 2)}
                        </pre>
                      )}
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
