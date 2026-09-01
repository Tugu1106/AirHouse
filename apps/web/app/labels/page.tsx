import { redirect } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { listItems, listBranches, getItemType } from '@airlink/core';
import { getCurrentUser } from '@/lib/session';
import { scanUrl } from '@/lib/config';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

// Batch label sheet: a printable grid of QR asset tags for a whole branch (or
// all items when no branch is given). Admin only.
export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { branch } = await searchParams;

  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') redirect('/login');

  const [items, branches] = await Promise.all([
    listItems(branch ? { branchId: branch } : {}),
    listBranches(),
  ]);
  const scopeName = branch
    ? (branches.find((b) => b.id === branch)?.name ?? 'Branch')
    : 'All branches';

  const str = (v: unknown) => (v == null || v === '' ? null : String(v));
  const labels = await Promise.all(
    items.map(async (it) => {
      const def = getItemType(it.type);
      const props = it.properties as Record<string, unknown>;
      return {
        id: it.id,
        type: def?.label ?? it.type,
        name: str(props.system_name) ?? str(props.model) ?? str(props.serial) ?? '',
        tag: `AIR-${it.id.slice(0, 8).toUpperCase()}`,
        qr: await QRCode.toString(scanUrl(it.id), { type: 'svg', margin: 0, width: 160 }),
      };
    }),
  );

  return (
    <div className="page">
      <style>{`
        .page { min-height: 100vh; background: #0b1120; padding: 24px 16px; }
        .toolbar { max-width: 900px; margin: 0 auto 20px; display: flex; align-items: center;
                   gap: 12px; color: #e2e8f0; }
        .sheet { max-width: 900px; margin: 0 auto; display: grid;
                 grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .label { background: #fff; color: #0b1120; border-radius: 8px; padding: 12px;
                 text-align: center; break-inside: avoid; }
        .label .qr { width: 150px; height: 150px; margin: 0 auto; }
        .label .qr svg { width: 100%; height: 100%; display: block; }
        .label .type { margin-top: 8px; font-size: 13px; font-weight: 700; }
        .label .name { font-size: 11px; color: #334155; word-break: break-word; }
        .label .tag { margin-top: 4px; font-family: ui-monospace, monospace; font-size: 11px;
                      letter-spacing: .5px; }
        @media print {
          .page { background: #fff !important; padding: 0; }
          .toolbar { display: none !important; }
          .sheet { max-width: none; gap: 8mm; }
          .label { border: 1px solid #e2e8f0; }
          @page { margin: 10mm; }
        }
      `}</style>

      <div className="toolbar">
        <div className="mr-auto">
          <div className="text-base font-semibold text-white">Asset labels — {scopeName}</div>
          <div className="text-xs text-slate-400">{labels.length} labels</div>
        </div>
        <PrintButton />
        <Link
          href={branch ? `/branch/${branch}` : '/inventory'}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← Back
        </Link>
      </div>

      {labels.length === 0 ? (
        <p className="text-center text-sm text-slate-500">No items to label here.</p>
      ) : (
        <div className="sheet">
          {labels.map((l) => (
            <div className="label" key={l.id}>
              <div className="qr" dangerouslySetInnerHTML={{ __html: l.qr }} />
              <div className="type">{l.type}</div>
              {l.name && <div className="name">{l.name}</div>}
              <div className="tag">{l.tag}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
