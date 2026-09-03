'use client';

import { useEffect } from 'react';

// Route-level error boundary (keeps the app shell). Same stale-chunk self-heal
// as global-error, for errors thrown below the root layout.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Failed to fetch/i.test(
      error?.message ?? '',
    );

  useEffect(() => {
    if (!isChunkError) return;
    const KEY = '__airhouse_chunk_reload__';
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(KEY) || 0);
    } catch {
      /* ignore */
    }
    if (Date.now() - last > 10_000) {
      try {
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      window.location.reload();
    }
  }, [isChunkError]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="mb-2 text-lg font-semibold text-white">
          {isChunkError ? 'Updating to the latest version…' : 'Something went wrong'}
        </h1>
        <p className="mb-5 text-sm text-slate-400">
          {isChunkError
            ? 'A new version was just deployed. Reloading to get it.'
            : 'The page hit an unexpected error. Reloading usually fixes it.'}
        </p>
        <button
          onClick={() => {
            try {
              reset();
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
          className="btn-primary"
        >
          Reload
        </button>
        {error?.digest && <p className="mt-4 text-[11px] text-slate-600">ref: {error.digest}</p>}
      </div>
    </main>
  );
}
