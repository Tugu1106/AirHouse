import type { Row } from '@/lib/branchStats';

// The inner content of a branch container, shared by the node map and the geo
// map. The wrapper (border, size, React Flow handles / drag) is supplied by
// each caller; this renders name + staff + item breakdown only.
export function BranchCard({
  name,
  staff,
  breakdown,
  isHq,
  compact = false,
}: {
  name: string;
  staff: number;
  breakdown: Row[];
  isHq: boolean;
  compact?: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-1">
        <span className={`truncate font-semibold text-white ${compact ? 'text-xs' : 'text-sm'}`}>
          {name}
        </span>
        {isHq && (
          <span className="rounded bg-brand/20 px-1 py-0.5 text-[9px] font-bold tracking-wider text-brand-light">
            HQ
          </span>
        )}
      </div>

      <div className={`flex items-baseline gap-1 ${compact ? 'mt-1' : 'mt-2 gap-1.5'}`}>
        <span className={`font-bold leading-none text-brand-light ${compact ? 'text-lg' : 'text-3xl'}`}>
          {staff}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">staff</span>
      </div>

      <div className={`space-y-0.5 border-t border-slate-800 ${compact ? 'mt-2 pt-1.5' : 'mt-3 space-y-1 pt-2'}`}>
        {breakdown.length === 0 ? (
          <div className={`text-slate-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>No items</div>
        ) : (
          breakdown.map((row) => (
            <div key={row.label} className={`flex items-center gap-2 ${compact ? 'text-[10px]' : 'text-xs'}`}>
              <span className="w-4 text-right font-semibold text-white">{row.count}</span>
              <span className="text-slate-400">{row.label}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
