'use client';

import { useRouter } from 'next/navigation';

// Returns to the exact previous page in history (inventory, a branch, an
// employee profile, …) instead of a hard-coded route.
export function BackButton({ label = 'Back' }: { label?: string }) {
  const router = useRouter();
  return (
    <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-brand">
      ← {label}
    </button>
  );
}
