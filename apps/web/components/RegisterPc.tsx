'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Laptop } from 'lucide-react';

type Status = 'idle' | 'waiting' | 'ready' | 'saving' | 'done' | 'error';

export function RegisterPc() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [script, setScript] = useState('');
  const [copied, setCopied] = useState(false);
  const [specs, setSpecs] = useState<Record<string, string> | null>(null);
  const [type, setType] = useState<string | null>(null);
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
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user can select manually */
    }
  };

  const close = () => {
    setOpen(false);
    setStatus('idle');
    setToken(null);
    setSpecs(null);
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
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  1. Open <b className="text-slate-200">PowerShell</b> (press Start, type “PowerShell”,
                  Enter). 2. Paste this and press Enter:
                </p>
                <div className="relative">
                  <pre className="max-h-52 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-300">
                    {script}
                  </pre>
                  <button
                    onClick={copy}
                    className="absolute right-2 top-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    {copied ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
                  Waiting for your PC to send its info…
                </div>
              </div>
            )}

            {status === 'ready' && specs && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">Your PC reported this — review and confirm:</p>
                <dl className="divide-y divide-slate-800 rounded-lg border border-slate-800">
                  <Row k="Type" v={type ?? '—'} />
                  {Object.entries(specs).map(([k, v]) => (
                    <Row key={k} k={k.replace('_', ' ')} v={v} />
                  ))}
                </dl>
                <button onClick={confirm} className="btn-primary w-full">
                  Confirm &amp; register
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
  return `$token = "${token}"
$url = "${origin}/api/scan/submit"
$cs = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$os = Get-CimInstance Win32_OperatingSystem
$chassis = @(Get-CimInstance Win32_SystemEnclosure | Select-Object -ExpandProperty ChassisTypes)
$isLaptop = ($chassis | Where-Object { $_ -in 8,9,10,11,12,14,18,21,30,31,32 }).Count -gt 0
$ramGB = [math]::Round($cs.TotalPhysicalMemory / 1GB)
$storage = (Get-CimInstance Win32_DiskDrive | ForEach-Object { "$([math]::Round($_.Size/1GB)) GB" }) -join ' + '
$body = @{ token = $token; type = if ($isLaptop) { "laptop" } else { "desktop" }; specs = @{ system_name = $env:COMPUTERNAME; model = "$($cs.Manufacturer) $($cs.Model)".Trim(); serial = $bios.SerialNumber; cpu = $cpu.Name.Trim(); ram = "$ramGB GB"; storage = $storage; os = $os.Caption } } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json" | Out-Null
Write-Host "Sent to AirHouse. Return to your browser to confirm." -ForegroundColor Green`;
}
