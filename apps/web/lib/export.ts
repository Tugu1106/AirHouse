// Client-side Excel export. Builds a single-sheet workbook where each branch is
// a banner section and its items are the rows beneath it. exceljs is loaded
// dynamically so it stays out of the main page bundle until Export is clicked.

import { listItemTypes, getItemType, type ItemWithRelations } from '@airlink/core';
import type { Branch } from '@airlink/core';

const typeLabel = (key: string) => getItemType(key)?.label ?? key;

// Every possible spec field across all item types, in a stable order.
function allFieldColumns(): { key: string; label: string }[] {
  const seen = new Set<string>();
  const out: { key: string; label: string }[] = [];
  for (const t of listItemTypes()) {
    for (const f of t.fields) {
      if (seen.has(f.key)) continue;
      seen.add(f.key);
      out.push({ key: f.key, label: f.label });
    }
  }
  return out;
}

function download(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportInventoryXlsx(data: {
  items: ItemWithRelations[];
  branches: Branch[];
}): Promise<void> {
  const { Workbook } = await import('exceljs');

  const live = data.items.filter((i) => !i.deleted_at);

  // Only keep spec columns that at least one item actually uses — keeps the
  // sheet clean instead of a wall of empty columns.
  const used = new Set<string>();
  for (const it of live) {
    for (const [k, v] of Object.entries(it.properties ?? {})) {
      if (v != null && v !== '') used.add(k);
    }
  }
  const fieldCols = allFieldColumns().filter((c) => used.has(c.key));
  const headers = ['Type', ...fieldCols.map((c) => c.label), 'Assignee', 'Status'];
  const colCount = headers.length;

  const wb = new Workbook();
  wb.creator = 'Airlink Assets';
  wb.created = new Date();
  const ws = wb.addWorksheet('Inventory');

  // Column widths — a touch generous, capped so it stays readable.
  ws.columns = headers.map((h) => ({ width: Math.min(28, Math.max(12, h.length + 2)) }));

  // HQ first, then alphabetical.
  const branches = [...data.branches].sort(
    (a, b) => (b.is_hq ? 1 : 0) - (a.is_hq ? 1 : 0) || a.name.localeCompare(b.name),
  );

  for (const b of branches) {
    const branchItems = live
      .filter((i) => i.branch_id === b.id)
      .sort((a, z) => a.type.localeCompare(z.type));

    // Branch banner (merged, brand-coloured).
    const banner = ws.addRow([
      `${b.name}${b.is_hq ? ' ★' : ''}   ·   ${branchItems.length} item${
        branchItems.length === 1 ? '' : 's'
      }`,
    ]);
    ws.mergeCells(banner.number, 1, banner.number, colCount);
    const bannerCell = banner.getCell(1);
    bannerCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } };
    bannerCell.alignment = { vertical: 'middle' };
    banner.height = 22;

    // Column header row.
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
    });

    if (branchItems.length === 0) {
      const empty = ws.addRow(['No items in this branch']);
      empty.getCell(1).font = { italic: true, color: { argb: 'FF94A3B8' } };
    } else {
      for (const it of branchItems) {
        const row = ws.addRow([
          typeLabel(it.type),
          ...fieldCols.map((c) => {
            const v = it.properties?.[c.key];
            return v == null || v === '' ? '' : (v as string | number);
          }),
          it.assignee?.name ?? 'Unassigned',
          it.status,
        ]);
        row.eachCell((cell) => {
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
          cell.alignment = { vertical: 'middle' };
        });
      }
    }

    ws.addRow([]); // spacer between branches
  }

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  download(buffer as ArrayBuffer, `airlink-inventory-${date}.xlsx`);
}
