'use client';

import { useEffect } from 'react';

// Top-level error boundary. The most common trigger here is a stale JS chunk
// after a new deploy (the open tab has old HTML that references a chunk whose
// hash changed) — that surfaces as a ChunkLoadError. We reload once to pull the
// new build; anything else shows a clean recover screen instead of the raw
// Next.js "client-side exception" text.
export default function GlobalError({
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
    // Reload at most once per 10s to avoid a loop if the error is not really
    // about a stale chunk.
    const KEY = '__airhouse_chunk_reload__';
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(KEY) || 0);
    } catch {
      /* storage may be unavailable */
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b1120',
          color: '#e2e8f0',
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ maxWidth: 380, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: '#fff' }}>
            {isChunkError ? 'Updating to the latest version…' : 'Something went wrong'}
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
            {isChunkError
              ? 'A new version was just deployed. Reloading to get it.'
              : 'The page hit an unexpected error. Reloading usually fixes it.'}
          </p>
          <button
            onClick={() => {
              try {
                reset();
              } catch {
                /* fall back to a full reload */
              }
              window.location.reload();
            }}
            style={{
              border: 'none',
              borderRadius: 8,
              background: '#0ea5e9',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              padding: '10px 20px',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {error?.digest && (
            <p style={{ fontSize: 11, color: '#475569', marginTop: 16 }}>ref: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
