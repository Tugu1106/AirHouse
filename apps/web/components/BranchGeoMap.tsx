'use client';

import dynamic from 'next/dynamic';

// Leaflet touches window, so load the map client-side only.
const LeafletBranchMap = dynamic(
  () => import('./LeafletBranchMap').then((m) => m.LeafletBranchMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full place-items-center bg-slate-900 text-sm text-slate-500">
        Loading map…
      </div>
    ),
  },
);

export function BranchGeoMap({ editable }: { editable: boolean }) {
  return (
    <div className="h-full w-full">
      <LeafletBranchMap editable={editable} />
    </div>
  );
}
