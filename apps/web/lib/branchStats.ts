import type { ItemWithRelations, Employee } from '@airlink/core';

export type Row = { label: string; count: number };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SHORT: Record<string, string> = {
  desktop: 'Desktop',
  laptop: 'Laptop',
  monitor: 'Monitor',
  mouse: 'Mouse',
  keyboard: 'Keyboard',
  printer: 'Printer',
  cable: 'Cable',
  lan_switch: 'LAN switch',
};

export function itemLabel(it: ItemWithRelations): string {
  // Group by item type; new registry types appear here automatically.
  // Legacy 'peripheral' items (pre-split) fall back to their subtype.
  if (it.type === 'peripheral') {
    const s = it.properties?.subtype;
    return s ? cap(String(s)) : 'Peripheral';
  }
  return SHORT[it.type] ?? cap(it.type);
}

/** True when (lat,lng) is a plausible Mongolia coordinate — rejects stale
 *  image-fraction values (0..1) saved by earlier map versions. */
export function inMongolia(lat: number, lng: number): boolean {
  return lat > 40 && lat < 55 && lng > 95 && lng < 122;
}

/** Great-circle distance in km between two lat/lng points (haversine). */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function branchStats(
  branchId: string,
  items: ItemWithRelations[],
  employees: Employee[],
): { staff: number; breakdown: Row[] } {
  const staff = employees.filter((e) => e.branch_id === branchId).length;
  const map = new Map<string, number>();
  for (const it of items) {
    if (it.branch_id !== branchId || it.deleted_at) continue;
    const l = itemLabel(it);
    map.set(l, (map.get(l) ?? 0) + 1);
  }
  const breakdown = [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
  return { staff, breakdown };
}
