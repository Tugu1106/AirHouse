'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useData } from './DataProvider';
import { branchStats } from '@/lib/branchStats';
import { setBranchPositionAction } from '@/lib/actions';

const UB_CENTER: [number, number] = [47.9186, 106.9177];

// On first load, frame the map to the placed branches (or the city if none).
function FitToBranches({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) map.fitBounds(points, { padding: [70, 70], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0]!, 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// All free, no API key required.
const TILE_STYLES = {
  dark: {
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    sub: 'abcd',
    attr: '&copy; OpenStreetMap contributors &copy; CARTO',
    max: 20,
  },
  voyager: {
    label: 'Voyager (colorful)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    sub: 'abcd',
    attr: '&copy; OpenStreetMap contributors &copy; CARTO',
    max: 20,
  },
  light: {
    label: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    sub: 'abcd',
    attr: '&copy; OpenStreetMap contributors &copy; CARTO',
    max: 20,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    sub: 'abc',
    attr: '&copy; Esri, Maxar, Earthstar Geographics',
    max: 19,
  },
  streets: {
    label: 'Streets (OSM)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    sub: 'abc',
    attr: '&copy; OpenStreetMap contributors',
    max: 19,
  },
} as const;

type StyleKey = keyof typeof TILE_STYLES;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Compact HTML pin (inline styles — Tailwind classes inside strings aren't
// picked up by the compiler, so we style directly).
function makeIcon(name: string, staff: number, items: number, isHq: boolean): L.DivIcon {
  // Central branch: blue background (the accent used for staff text) + dark ink.
  const bg = isHq ? '#38bdf8' : 'rgba(15,23,42,0.92)';
  const border = isHq ? '#0ea5e9' : '#334155';
  const nameC = isHq ? '#0b1120' : '#fff';
  const subC = isHq ? 'rgba(11,17,32,0.75)' : '#94a3b8';
  const staffC = isHq ? '#0b1120' : '#38bdf8';
  const itemsC = isHq ? '#0b1120' : '#fff';
  const html = `
    <div style="position:relative;transform:translate(-50%,-100%);min-width:92px;background:${bg};
      border:1px solid ${border};border-radius:8px;padding:4px 8px;font-family:system-ui,sans-serif;
      box-shadow:0 6px 16px rgba(0,0,0,.55);white-space:nowrap;">
      <div style="font-size:12px;font-weight:600;color:${nameC};">
        ${esc(name)}${isHq ? ' <span style="color:#0b1120;font-size:9px;font-weight:800;">★ HQ</span>' : ''}
      </div>
      <div style="font-size:11px;color:${subC};margin-top:1px;">
        <b style="color:${staffC};">${staff}</b> staff · <b style="color:${itemsC};">${items}</b> items
      </div>
      <div style="position:absolute;left:50%;bottom:-5px;width:8px;height:8px;background:${bg};
        border-right:1px solid ${border};border-bottom:1px solid ${border};transform:translateX(-50%) rotate(45deg);"></div>
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [0, 0], iconAnchor: [0, 0] });
}

export function LeafletBranchMap({ editable }: { editable: boolean }) {
  const { branches, items, employees, refresh } = useData();
  const router = useRouter();

  const coords = useRef<Record<string, { lat: number; lng: number }>>({});
  const dirty = useRef<Set<string>>(new Set());
  const wasEditing = useRef(editable);

  const [style, setStyle] = useState<StyleKey>('satellite');
  useEffect(() => {
    const saved = localStorage.getItem('mapStyle') as StyleKey | null;
    if (saved && saved in TILE_STYLES) setStyle(saved);
  }, []);
  const chooseStyle = (s: StyleKey) => {
    setStyle(s);
    localStorage.setItem('mapStyle', s);
  };
  const tiles = TILE_STYLES[style];

  // Save only when leaving edit mode (Done editing) — batched.
  useEffect(() => {
    if (wasEditing.current && !editable) {
      const ids = [...dirty.current];
      if (ids.length) {
        (async () => {
          for (const id of ids) {
            const c = coords.current[id];
            if (c) await setBranchPositionAction(id, c.lng, c.lat); // map_x = lng, map_y = lat
          }
          dirty.current.clear();
          await refresh();
        })();
      }
    }
    wasEditing.current = editable;
  }, [editable, refresh]);

  // Only accept coordinates that actually look like Mongolia — this ignores
  // stale image-fraction values (0..1) saved by earlier map versions.
  const looksLikeMongolia = (lat: number, lng: number) =>
    lat > 40 && lat < 55 && lng > 95 && lng < 122;

  const posFor = (b: (typeof branches)[number], i: number): [number, number] => {
    const saved = coords.current[b.id];
    if (saved) return [saved.lat, saved.lng];
    if (b.map_x != null && b.map_y != null && looksLikeMongolia(b.map_y, b.map_x)) {
      return [b.map_y, b.map_x]; // lat = map_y, lng = map_x
    }
    // unplaced (or stale coords) → cluster near the city centre so you can drag them out
    return [UB_CENTER[0] + 0.012 * ((i % 4) - 1.5), UB_CENTER[1] + 0.02 * (Math.floor(i / 4) - 0.5)];
  };

  return (
    <div className="relative h-full w-full">
      <div className="absolute right-3 top-3 z-[1000]">
        <select
          value={style}
          onChange={(e) => chooseStyle(e.target.value as StyleKey)}
          className="rounded-md border border-slate-700 bg-slate-900/90 px-2 py-1 text-xs text-slate-200 shadow backdrop-blur focus:outline-none"
        >
          {Object.entries(TILE_STYLES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <MapContainer
        center={UB_CENTER}
        zoom={13}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: '#0b1120' }}
      >
        <FitToBranches
          points={branches
            .filter((b) => b.map_x != null && b.map_y != null && looksLikeMongolia(b.map_y, b.map_x))
            .map((b) => [b.map_y as number, b.map_x as number])}
        />
        <TileLayer
          key={style}
          url={tiles.url}
          attribution={tiles.attr}
          subdomains={tiles.sub}
          maxZoom={tiles.max}
        />
        {branches.map((b, i) => {
        const [lat, lng] = posFor(b, i);
        const { staff, breakdown } = branchStats(b.id, items, employees);
        const totalItems = breakdown.reduce((s, r) => s + r.count, 0);
        return (
          <Marker
            key={b.id}
            position={[lat, lng]}
            icon={makeIcon(b.name, staff, totalItems, b.is_hq)}
            draggable={editable}
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                coords.current[b.id] = { lat: p.lat, lng: p.lng };
                dirty.current.add(b.id);
              },
              click: () => {
                if (!editable) router.push(`/branch/${b.id}`);
              },
            }}
          />
          );
        })}
      </MapContainer>
    </div>
  );
}
