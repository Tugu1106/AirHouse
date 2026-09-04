import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { listItems, listBranches, getItemType, type ItemWithRelations } from '@airlink/core';
import { getCurrentUser } from '@/lib/session';
import { scanUrl } from '@/lib/config';
import { LabelSheet } from '@/components/LabelSheet';

export const dynamic = 'force-dynamic';

const str = (v: unknown) => (v == null || v === '' ? null : String(v));

async function toLabel(it: ItemWithRelations) {
  const props = it.properties as Record<string, unknown>;
  return {
    id: it.id,
    type: getItemType(it.type)?.label ?? it.type,
    name: str(props.model) ?? str(props.system_name) ?? str(props.serial) ?? '',
    // 3rd line: the computer's system name (e.g. AIR-SHINEKHUU); items without
    // one (monitors, mice, …) fall back to the short asset id so it's still labeled.
    tag: str(props.system_name) ?? `AIR-${it.id.slice(0, 8).toUpperCase()}`,
    qr: await QRCode.toString(scanUrl(it.id), { type: 'svg', margin: 0, width: 160 }),
  };
}

// Batch label sheet: a printable QR grid. A single branch when ?branch=<id>, or
// the whole inventory grouped into per-branch sections (each starts a new page).
export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; sort?: string }>;
}) {
  const { branch, sort } = await searchParams;

  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') redirect('/login');

  // Mirror the sort picked in the inventory table (e.g. "type:asc").
  const [sortBy, sortDir] = (sort ?? '').split(':');

  const [items, branches] = await Promise.all([
    listItems({
      ...(branch ? { branchId: branch } : {}),
      sortBy: (sortBy || undefined) as
        | 'created_at'
        | 'updated_at'
        | 'type'
        | 'status'
        | 'sort_order'
        | undefined,
      sortDir: (sortDir || undefined) as 'asc' | 'desc' | undefined,
    }),
    listBranches(),
  ]);

  // Build per-branch groups (one group when scoped to a single branch).
  const groupsRaw: { id: string; name: string; items: ItemWithRelations[] }[] = [];
  if (branch) {
    groupsRaw.push({
      id: branch,
      name: branches.find((b) => b.id === branch)?.name ?? 'Branch',
      items,
    });
  } else {
    for (const b of branches) {
      const its = items.filter((i) => i.branch_id === b.id);
      if (its.length) groupsRaw.push({ id: b.id, name: b.name, items: its });
    }
    const orphans = items.filter((i) => !branches.some((b) => b.id === i.branch_id));
    if (orphans.length) groupsRaw.push({ id: 'none', name: 'No branch', items: orphans });
  }

  const groups = await Promise.all(
    groupsRaw.map(async (g) => ({
      id: g.id,
      name: g.name,
      labels: await Promise.all(g.items.map(toLabel)),
    })),
  );
  const total = groups.reduce((n, g) => n + g.labels.length, 0);
  const scopeName = branch ? (groups[0]?.name ?? 'Branch') : 'All inventory';

  return (
    <div className="page">
      <style>{`
        .page { min-height: 100vh; background: #0b1120; padding: 24px 16px; }
        .toolbar { max-width: 900px; margin: 0 auto 20px; display: flex; align-items: center;
                   gap: 12px; color: #e2e8f0; }
        .section { max-width: 900px; margin: 0 auto 28px; }
        .section-title { display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px;
                         font-size: 15px; font-weight: 700; color: #e2e8f0;
                         border-bottom: 1px solid #1e293b; padding-bottom: 8px; }
        .section-title span { font-size: 12px; font-weight: 500; color: #64748b; }
        .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .label { background: #fff; color: #0b1120; border-radius: 8px; padding: 10px;
                 text-align: center; break-inside: avoid; }
        .label .qr { width: 100%; aspect-ratio: 1 / 1; margin: 0 auto; }
        .label .qr svg { width: 100%; height: 100%; display: block; }
        .label .type { margin-top: 8px; font-size: 13px; font-weight: 700; }
        .label .name { font-size: 11px; color: #334155; word-break: break-word; }
        .label .tag { margin-top: 4px; font-family: ui-monospace, monospace; font-size: 11px;
                      letter-spacing: .5px; }
        @media print {
          .page { background: #fff !important; padding: 0; }
          .toolbar { display: none !important; }
          .section { max-width: none; margin: 0; }
          .section + .section { break-before: page; }
          .section-title { color: #0b1120; border-color: #cbd5e1; font-size: 14pt;
                           margin: 0 0 6mm; padding-bottom: 3mm; }
          .section-title span { color: #475569; }
          .sheet { gap: 8mm; }
          .label { border: 1px solid #e2e8f0; }
          @page { margin: 10mm; }
        }
      `}</style>

      <LabelSheet
        groups={groups}
        scoped={!!branch}
        total={total}
        scopeName={scopeName}
        backHref={branch ? `/branch/${branch}` : '/inventory'}
      />
    </div>
  );
}
