// Client-side Excel export. Produces a workbook with an "All" sheet (every
// branch as a banner section) followed by one sheet per branch. exceljs is
// loaded dynamically so it stays out of the main page bundle until Export runs.

import { listItemTypes, getItemType, type ItemWithRelations } from '@airlink/core';
import type { Branch } from '@airlink/core';
import type { Row, Worksheet } from 'exceljs';

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

type Col = { key: string; label: string };

// Only the spec columns at least one of these items actually uses.
function fieldColumnsFor(items: ItemWithRelations[]): Col[] {
  const used = new Set<string>();
  for (const it of items) {
    for (const [k, v] of Object.entries(it.properties ?? {})) {
      if (v != null && v !== '') used.add(k);
    }
  }
  return allFieldColumns().filter((c) => used.has(c.key));
}

function rowValues(it: ItemWithRelations, fieldCols: Col[]): (string | number)[] {
  return [
    typeLabel(it.type),
    ...fieldCols.map((c) => {
      const v = it.properties?.[c.key];
      return v == null || v === '' ? '' : (v as string | number);
    }),
    it.assignee?.name ?? 'Unassigned',
    it.status,
  ];
}

// Auto-size each column to its widest cell — generous padding so nothing is
// cramped, with a sensible floor and ceiling.
function computeWidths(headers: string[], dataRows: (string | number)[][]): number[] {
  return headers.map((h, i) => {
    let max = String(h).length;
    for (const r of dataRows) {
      const len = r[i] == null ? 0 : String(r[i]).length;
      if (len > max) max = len;
    }
    return Math.min(55, Math.max(16, max + 6));
  });
}

// Excel sheet names: ≤31 chars, no \ / ? * [ ] :, unique (case-insensitive).
function uniqueSheetName(raw: string, usedLower: Set<string>): string {
  const base = (raw.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Branch');
  let name = base;
  let n = 2;
  while (usedLower.has(name.toLowerCase())) {
    const suffix = ` (${n++})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  usedLower.add(name.toLowerCase());
  return name;
}

const BRAND = 'FF0EA5E9';
const HEADER_FILL = 'FFE2E8F0';

// Render one branch block: banner → header → item rows.
function renderSection(
  ws: Worksheet,
  headers: string[],
  fieldCols: Col[],
  items: ItemWithRelations[],
  bannerText: string,
): void {
  const colCount = headers.length;

  const banner = ws.addRow([bannerText]);
  ws.mergeCells(banner.number, 1, banner.number, colCount);
  const bannerCell = banner.getCell(1);
  bannerCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
  bannerCell.alignment = { vertical: 'middle', indent: 1 };
  banner.height = 26;

  const headerRow = ws.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
    cell.alignment = { vertical: 'middle', indent: 1 };
  });

  if (items.length === 0) {
    const empty = ws.addRow(['No items in this branch']);
    empty.getCell(1).font = { italic: true, color: { argb: 'FF94A3B8' } };
    empty.height = 20;
    return;
  }

  for (const it of items) {
    const row: Row = ws.addRow(rowValues(it, fieldCols));
    row.height = 20;
    row.eachCell((cell) => {
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      cell.alignment = { vertical: 'middle', indent: 1 };
    });
  }
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
  const branches = [...data.branches].sort(
    (a, b) => (b.is_hq ? 1 : 0) - (a.is_hq ? 1 : 0) || a.name.localeCompare(b.name),
  );
  const itemsOf = (b: Branch) =>
    live.filter((i) => i.branch_id === b.id).sort((a, z) => a.type.localeCompare(z.type));
  const bannerFor = (b: Branch, n: number) =>
    `${b.name}${b.is_hq ? ' ★' : ''}   ·   ${n} item${n === 1 ? '' : 's'}`;

  const wb = new Workbook();
  wb.creator = 'Airlink Assets';
  wb.created = new Date();

  // --- Sheet 1: "All" — every branch as a banner section ---
  const allCols = fieldColumnsFor(live);
  const allHeaders = ['Type', ...allCols.map((c) => c.label), 'Assignee', 'Status'];
  const wsAll = wb.addWorksheet('All');
  wsAll.columns = computeWidths(
    allHeaders,
    live.map((it) => rowValues(it, allCols)),
  ).map((w) => ({ width: w }));
  for (const b of branches) {
    const bItems = itemsOf(b);
    renderSection(wsAll, allHeaders, allCols, bItems, bannerFor(b, bItems.length));
    wsAll.addRow([]); // spacer between branches
  }

  // --- One sheet per branch ---
  const usedLower = new Set<string>(['all']);
  for (const b of branches) {
    const bItems = itemsOf(b);
    const cols = fieldColumnsFor(bItems);
    const headers = ['Type', ...cols.map((c) => c.label), 'Assignee', 'Status'];
    const ws = wb.addWorksheet(uniqueSheetName(b.name, usedLower), {
      views: [{ state: 'frozen', ySplit: 2 }], // keep banner + header visible while scrolling
    });
    ws.columns = computeWidths(
      headers,
      bItems.map((it) => rowValues(it, cols)),
    ).map((w) => ({ width: w }));
    renderSection(ws, headers, cols, bItems, bannerFor(b, bItems.length));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  download(buffer as ArrayBuffer, `airlink-inventory-${date}.xlsx`);
}
