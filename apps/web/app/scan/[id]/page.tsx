import { getItemWithRelations, getItemType } from '@airlink/core';
import { ScanDetails } from '@/components/ScanDetails';

export const dynamic = 'force-dynamic';

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

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  in_repair: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  retired: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  lost: 'bg-red-500/15 text-red-300 ring-red-500/30',
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b1120]">
      <header className="border-b border-slate-800/80 px-6 py-3">
        <div className="mx-auto flex max-w-md items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-32.png" alt="AIRHOUSE" className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-wide text-white">AIRHOUSE</span>
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 py-6">{children}</main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-slate-800 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-100">{value}</dd>
    </div>
  );
}

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItemWithRelations(id);

  if (!item) {
    return (
      <Shell>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <div className="text-4xl">🔍</div>
          <h1 className="mt-3 text-lg font-semibold text-white">Item not found</h1>
          <p className="mt-1 text-sm text-slate-400">
            This tag doesn’t match any asset in AirHouse. It may have been removed.
          </p>
        </div>
      </Shell>
    );
  }

  const def = getItemType(item.type);
  const props = item.properties as Record<string, unknown>;
  const str = (v: unknown) => (v == null || v === '' ? null : String(v));
  const mainName =
    str(props.system_name) ?? str(props.model) ?? str(props.serial) ?? def?.label ?? item.type;
  const owner = item.assignee?.name ?? null;
  const branch = item.branch?.name ?? '—';

  // Full spec sheet from the item type's fields (empty slots shown as —).
  const specs = (def?.fields ?? []).map((f) => ({
    label: f.label,
    value: str(props[f.key]) ?? '—',
  }));

  return (
    <Shell>
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {/* Hero */}
        <div className="flex items-center gap-4 p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-slate-800 text-2xl">
            {ITEM_ICON[item.type] ?? '📦'}
          </span>
          <div className="min-w-0">
            <div className="text-lg font-semibold text-white">{def?.label ?? item.type}</div>
            <div className="truncate text-sm text-slate-400">{mainName}</div>
          </div>
          <span
            className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
              STATUS_STYLE[item.status] ?? STATUS_STYLE.retired
            }`}
          >
            {item.status.replace('_', ' ')}
          </span>
        </div>

        {/* Owner — the headline answer to "whose is this?" */}
        <div className="border-t border-slate-800 bg-slate-800/40 px-5 py-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Assigned to
          </div>
          <div className="mt-1 text-xl font-semibold text-white">
            {owner ?? 'Unassigned'}
          </div>
        </div>

        {/* Details */}
        <dl className="px-5">
          <Row label="Branch" value={branch} />
          {str(props.serial) && <Row label="Serial" value={str(props.serial)!} />}
          {str(props.model) && <Row label="Model" value={str(props.model)!} />}
          <Row label="Status" value={item.status.replace('_', ' ')} />
        </dl>

        <div className="px-5 py-4">
          <ScanDetails title={def?.label ?? item.type} subtitle={mainName || undefined} specs={specs} />
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate-600">
        Live from AIRHOUSE asset tracker · read-only
      </p>
    </Shell>
  );
}
