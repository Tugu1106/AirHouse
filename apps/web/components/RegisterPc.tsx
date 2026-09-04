'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Laptop, Download, RefreshCw } from 'lucide-react';

type Status = 'idle' | 'waiting' | 'ready' | 'saving' | 'done' | 'error';

// "just now" / "3 min ago" / "2 h ago" for the last-scan timestamp.
function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 30) return 'just now';
  if (s < 90) return '1 min ago';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

// Clipboard works only in a secure context (HTTPS); fall back for plain HTTP.
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function RegisterPc() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [script, setScript] = useState('');
  const [copied, setCopied] = useState(false);
  const [specs, setSpecs] = useState<Record<string, string> | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const start = async () => {
    setOpen(true);
    setStatus('waiting');
    setSpecs(null);
    setMessage('');
    try {
      const res = await fetch('/api/scan/start', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error ?? 'Could not start.');
        return;
      }
      setToken(data.token);
      setScript(buildScript(data.token, window.location.origin));
      // Same employee already scanned this session → skip straight to review.
      if (data.ready && data.specs) {
        setSpecs(data.specs);
        setType(data.type);
        setScannedAt(data.scannedAt ?? null);
        setStatus('ready');
      }
    } catch {
      setStatus('error');
      setMessage('Could not start.');
    }
  };

  // Poll for the PC's info while waiting.
  useEffect(() => {
    if (status !== 'waiting' || !token) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan/status?token=${token}`);
        const data = await res.json();
        if (data.ready) {
          setSpecs(data.specs);
          setType(data.type);
          setScannedAt(data.scannedAt ?? Date.now());
          setStatus('ready');
        }
      } catch {
        /* keep polling */
      }
    }, 2500);
    return () => clearInterval(id);
  }, [status, token]);

  const confirm = async () => {
    if (!token) return;
    setStatus('saving');
    try {
      const res = await fetch('/api/scan/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus('done');
        setMessage('Registered — it now shows in your items below.');
        router.refresh();
      } else {
        setStatus('error');
        setMessage(data.message ?? 'Could not register.');
      }
    } catch {
      setStatus('error');
      setMessage('Could not register.');
    }
  };

  const copy = async () => {
    const ok = await copyText(script);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Re-scan: forget the stored specs, re-download the scanner, wait for fresh data.
  const rescan = async () => {
    if (!token) return;
    try {
      await fetch('/api/scan/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch {
      /* proceed anyway; a fresh submit overwrites the old specs */
    }
    setSpecs(null);
    setScannedAt(null);
    setMessage('');
    setStatus('waiting');
    downloadBat();
  };

  const downloadBat = () => {
    if (!token) return;
    const bat = buildBat(token, window.location.origin);
    const blob = new Blob([bat], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'airhouse-scan.bat';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const close = () => {
    setOpen(false);
    setStatus('idle');
    setToken(null);
    setSpecs(null);
    setScannedAt(null);
    setMessage('');
  };

  return (
    <>
      <button onClick={start} className="btn-primary inline-flex items-center gap-2">
        <Laptop className="h-4 w-4" /> Register my PC
      </button>

      {open && (
        <div
          className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="animate-modal w-full max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Register this PC</h2>
              <button onClick={close} aria-label="Close" className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {status === 'waiting' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-slate-300">
                    <b className="text-white">1.</b> Download the scanner and{' '}
                    <b className="text-white">double-click it</b>:
                  </p>
                  <button
                    onClick={downloadBat}
                    className="btn-primary inline-flex w-full items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" /> Download scanner
                  </button>
                  <p className="text-xs text-slate-500">
                    A black window flashes for a second while it reads your PC — then it closes on
                    its own. If Windows warns “unrecognized app”, click{' '}
                    <b className="text-slate-300">More info → Run anyway</b>. Come back here after.
                  </p>
                </div>

                <details className="rounded-lg border border-slate-800 bg-slate-950/50">
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs text-slate-400 hover:text-slate-200">
                    Prefer to paste a command instead?
                  </summary>
                  <div className="space-y-2 border-t border-slate-800 p-3">
                    <p className="text-xs text-slate-500">
                      Open <b className="text-slate-300">PowerShell</b> (Start → type “PowerShell” →
                      Enter), paste this, press Enter:
                    </p>
                    <div className="relative">
                      <pre className="max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-300">
                        {script}
                      </pre>
                      <button
                        onClick={copy}
                        className="absolute right-2 top-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        {copied ? 'Copied ✓' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </details>

                <div className="flex items-center gap-2 border-t border-slate-800 pt-3 text-sm text-slate-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
                  Waiting for your PC to send its info…
                </div>
              </div>
            )}

            {status === 'ready' && specs && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-200">Last scan</p>
                  <span className="text-xs text-slate-500">
                    {scannedAt ? timeAgo(scannedAt) : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  These are the specs your PC reported. If they look right, register them — otherwise
                  re-scan to read the PC again.
                </p>
                <dl className="divide-y divide-slate-800 rounded-lg border border-slate-800">
                  <Row k="Type" v={type ?? '—'} />
                  {Object.entries(specs).map(([k, v]) => (
                    <Row key={k} k={k.replace('_', ' ')} v={v} />
                  ))}
                </dl>
                <button onClick={confirm} className="btn-primary w-full">
                  Confirm &amp; register
                </button>
                <button
                  onClick={rescan}
                  className="btn-ghost inline-flex w-full items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" /> Re-scan this PC
                </button>
              </div>
            )}

            {status === 'saving' && <p className="text-sm text-slate-400">Registering…</p>}

            {status === 'done' && (
              <div className="space-y-3">
                <p className="text-sm text-emerald-400">✓ {message}</p>
                <button onClick={close} className="btn-ghost">
                  Done
                </button>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-3">
                <p className="text-sm text-red-400">⚠ {message}</p>
                <button onClick={close} className="btn-ghost">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 px-3 py-2 text-sm">
      <dt className="capitalize text-slate-500">{k}</dt>
      <dd className="break-words text-right font-medium text-slate-100">{v}</dd>
    </div>
  );
}

function buildScript(token: string, origin: string): string {
  return `$ErrorActionPreference = "Stop"
try {
  $cs = Get-CimInstance Win32_ComputerSystem
  $bios = Get-CimInstance Win32_BIOS
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  $os = Get-CimInstance Win32_OperatingSystem
  $chassis = @(Get-CimInstance Win32_SystemEnclosure | Select-Object -ExpandProperty ChassisTypes)
  $isLaptop = ($chassis | Where-Object { $_ -in 8,9,10,11,12,14,18,21,30,31,32 }).Count -gt 0
  $ramGB = [math]::Round($cs.TotalPhysicalMemory / 1GB)
  $storage = (Get-PhysicalDisk | ForEach-Object { $m = $_.MediaType; if (-not $m -or $m -eq 'Unspecified') { $m = if ($_.BusType -eq 'NVMe') { 'SSD' } else { '' } }; ("{0} GB {1}" -f [math]::Round($_.Size / 1GB), $m).Trim() }) -join ' + '
  $type = if ($isLaptop) { "laptop" } else { "desktop" }
  $specs = @{ system_name = $env:COMPUTERNAME; model = "$($cs.Manufacturer) $($cs.Model)".Trim(); serial = $bios.SerialNumber; cpu = $cpu.Name.Trim(); ram = "$ramGB GB"; storage = $storage; os = $os.Caption }
  Write-Host ""
  Write-Host "This PC:" -ForegroundColor Cyan
  Write-Host ("  Type:    " + $type)
  Write-Host ("  System:  " + $specs.system_name)
  Write-Host ("  Model:   " + $specs.model)
  Write-Host ("  Serial:  " + $specs.serial)
  Write-Host ("  CPU:     " + $specs.cpu)
  Write-Host ("  RAM:     " + $specs.ram)
  Write-Host ("  Storage: " + $specs.storage)
  Write-Host ("  OS:      " + $specs.os)
  Write-Host ""
  $body = @{ token = "${token}"; type = $type; specs = $specs } | ConvertTo-Json -Depth 4
  Invoke-RestMethod -Uri "${origin}/api/scan/submit" -Method Post -Body $body -ContentType "application/json" | Out-Null
  Write-Host "Success! Return to your browser and click Confirm." -ForegroundColor Green
} catch {
  Write-Host "Could not send to AirHouse: $($_.Exception.Message)" -ForegroundColor Red
}`;
}

// Encode a PowerShell script as a base64 UTF-16LE string for -EncodedCommand.
// This sidesteps all quote-escaping when embedding the script inside a .bat.
function toEncodedCommand(script: string): string {
  const buf = new Uint8Array(script.length * 2);
  for (let i = 0; i < script.length; i++) {
    const c = script.charCodeAt(i);
    buf[i * 2] = c & 0xff;
    buf[i * 2 + 1] = (c >> 8) & 0xff;
  }
  let bin = '';
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
  return btoa(bin);
}

// A double-clickable .bat that runs the scan via PowerShell (execution-policy
// bypassed, no admin needed). \r\n line endings so Windows parses it correctly.
function buildBat(token: string, origin: string): string {
  const enc = toEncodedCommand(buildScript(token, origin));
  return [
    '@echo off',
    'title AirHouse PC Scan',
    'echo Reading this PC and sending it to AirHouse...',
    'echo.',
    `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${enc}`,
    'echo.',
    'echo You can close this window and go back to your browser.',
    'pause',
    '',
  ].join('\r\n');
}
