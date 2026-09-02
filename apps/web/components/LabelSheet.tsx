'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { reorderItemsAction } from '@/lib/actions';

export interface SheetLabel {
  id: string;
  type: string;
  name: string;
  tag: string;
  qr: string; // inline SVG markup
}
export interface SheetGroup {
  id: string;
  name: string;
  labels: SheetLabel[];
}

// The QR print sheet, but draggable: rearrange the cards (per branch section),
// then Print in that order — or Save it back as the branch's custom order.
export function LabelSheet({
  groups,
  scoped,
  total,
  scopeName,
  backHref,
}: {
  groups: SheetGroup[];
  scoped: boolean;
  total: number;
  scopeName: string;
  backHref: string;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const byId = new Map<string, SheetLabel>();
  for (const g of groups) for (const l of g.labels) byId.set(l.id, l);

  const [order, setOrder] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.labels.map((l) => l.id)])),
  );
  const [saved, setSaved] = useState(false);

  const onDragEnd = (gid: string) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((cur) => {
      const ids = cur[gid];
      if (!ids) return cur;
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from < 0 || to < 0) return cur;
      return { ...cur, [gid]: arrayMove(ids, from, to) };
    });
    setSaved(false);
  };

  const save = async () => {
    for (const g of groups) await reorderItemsAction(order[g.id] ?? []);
    setSaved(true);
  };

  return (
    <>
      <div className="toolbar">
        <div className="mr-auto">
          <div className="text-base font-semibold text-white">Asset QR codes — {scopeName}</div>
          <div className="text-xs text-slate-400">
            {total} codes{!scoped && groups.length > 1 ? ` · ${groups.length} branches` : ''} · drag
            to arrange
          </div>
        </div>
        <button
          onClick={save}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          title="Save this arrangement as the branch's custom order"
        >
          {saved ? 'Saved ✓' : 'Save order'}
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light"
        >
          🖨 Print
        </button>
        <Link
          href={backHref}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← Back
        </Link>
      </div>

      {total === 0 ? (
        <p className="text-center text-sm text-slate-500">No items to label here.</p>
      ) : (
        groups.map((g) => (
          <section className="section" key={g.id}>
            {!scoped && (
              <div className="section-title">
                {g.name} <span>{g.labels.length} items</span>
              </div>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(g.id)}>
              <SortableContext items={order[g.id] ?? []} strategy={rectSortingStrategy}>
                <div className="sheet">
                  {(order[g.id] ?? []).map((id) => {
                    const l = byId.get(id);
                    return l ? <SortableCard key={id} label={l} /> : null;
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        ))
      )}
    </>
  );
}

function SortableCard({ label }: { label: SheetLabel }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: label.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    cursor: 'grab',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="label touch-none">
      <div className="qr" dangerouslySetInnerHTML={{ __html: label.qr }} />
      <div className="type">{label.type}</div>
      {label.name && <div className="name">{label.name}</div>}
      <div className="tag">{label.tag}</div>
    </div>
  );
}
