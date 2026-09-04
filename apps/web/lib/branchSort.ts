// Order branches for selection dropdowns: HQ (downtown headquarters) first,
// then the rest alphabetically. Display-only — does not change stored order.
export function hqFirst<T extends { is_hq?: boolean | null; name: string }>(branches: T[]): T[] {
  return [...branches].sort(
    (a, b) => (b.is_hq ? 1 : 0) - (a.is_hq ? 1 : 0) || a.name.localeCompare(b.name),
  );
}
