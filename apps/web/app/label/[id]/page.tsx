import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { getItemWithRelations, getItemType } from '@airlink/core';
import { getCurrentUser } from '@/lib/session';
import { scanUrl } from '@/lib/config';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

// Print-ready asset-tag label for one item: a QR that opens the public scan
// page, plus a human-readable tag and name. Admin only.
export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') redirect('/login');

  const item = await getItemWithRelations(id);
  if (!item) notFound();

  const def = getItemType(item.type);
  const props = item.properties as Record<string, unknown>;
  const str = (v: unknown) => (v == null || v === '' ? null : String(v));
  const mainName = str(props.system_name) ?? str(props.model) ?? str(props.serial) ?? '';
  const tag = `AIR-${id.slice(0, 8).toUpperCase()}`;

  const qrSvg = await QRCode.toString(scanUrl(id), { type: 'svg', margin: 0, width: 240 });

  return (
    <div className="page">
      <style>{`
        .page { min-height: 100vh; background: #0b1120; display: flex; flex-direction: column;
                align-items: center; gap: 20px; padding: 32px 16px; }
        .toolbar { display: flex; gap: 12px; }
        .label { background: #ffffff; color: #0b1120; width: 300px; border-radius: 10px;
                 padding: 20px; text-align: center; box-shadow: 0 8px 30px rgba(0,0,0,.4); }
        .label .qr { width: 220px; height: 220px; margin: 0 auto; }
        .label .qr svg { width: 100%; height: 100%; display: block; }
        .label .type { margin-top: 12px; font-size: 15px; font-weight: 700; }
        .label .name { font-size: 13px; color: #334155; word-break: break-word; }
        .label .tag { margin-top: 8px; font-family: ui-monospace, monospace; font-size: 13px;
                      letter-spacing: 1px; color: #0b1120; }
        .label .brand { margin-top: 6px; font-size: 10px; letter-spacing: 2px; color: #64748b; }
        @media print {
          .page { background: #fff !important; padding: 0; min-height: auto; }
          .toolbar, .back { display: none !important; }
          .label { box-shadow: none; width: auto; }
        }
      `}</style>

      <div className="toolbar">
        <PrintButton />
        <Link
          href={`/item/${id}`}
          className="back rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← Back
        </Link>
      </div>

      <div className="label">
        <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="type">{def?.label ?? item.type}</div>
        {mainName && <div className="name">{mainName}</div>}
        <div className="tag">{tag}</div>
        <div className="brand">AIRHOUSE</div>
      </div>

      <p className="back text-xs text-slate-600">Scan opens the live owner page · {scanUrl(id)}</p>
    </div>
  );
}
