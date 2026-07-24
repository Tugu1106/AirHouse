'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useData } from './DataProvider';
import { BranchCard } from './BranchCard';
import { branchStats, type Row } from '@/lib/branchStats';

const NODE_W = 210;
const NODE_MIN_H = 220;
const POS_H = NODE_MIN_H;

type BranchData = { name: string; staff: number; breakdown: Row[]; isHq: boolean };

const centerHandle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', opacity: 0 } as const;

function BranchNode({ data }: NodeProps<Node<BranchData>>) {
  return (
    <div
      style={{ width: NODE_W, minHeight: NODE_MIN_H }}
      className={`flex cursor-pointer flex-col rounded-xl border bg-slate-900/90 px-4 py-3 shadow-lg backdrop-blur transition hover:-translate-y-0.5 ${
        data.isHq
          ? 'border-brand shadow-[0_0_45px_-6px_rgba(14,165,233,0.9)]'
          : 'border-slate-700 hover:border-brand hover:shadow-[0_0_30px_-8px_rgba(14,165,233,0.95)]'
      }`}
    >
      <Handle type="target" position={Position.Top} style={centerHandle} />
      <Handle type="source" position={Position.Bottom} style={centerHandle} />
      <BranchCard name={data.name} staff={data.staff} breakdown={data.breakdown} isHq={data.isHq} />
    </div>
  );
}

const nodeTypes = { branch: BranchNode };

export function BranchMap() {
  const { branches, items, employees } = useData();
  const router = useRouter();

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    if (branches.length === 0) return { nodes, edges };

    const hqBranch = branches.find((b) => b.is_hq);
    const hq = (hqBranch ?? branches[0])!;
    const others = branches.filter((b) => b.id !== hq.id);

    nodes.push({
      id: hq.id,
      type: 'branch',
      position: { x: -NODE_W / 2, y: -POS_H / 2 },
      data: { name: hq.name, isHq: !!hqBranch, ...branchStats(hq.id, items, employees) },
    });

    const radius = 360;
    others.forEach((b, i) => {
      const angle = (i / Math.max(others.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      nodes.push({
        id: b.id,
        type: 'branch',
        position: { x: x - NODE_W / 2, y: y - POS_H / 2 },
        data: { name: b.name, isHq: false, ...branchStats(b.id, items, employees) },
      });
      edges.push({
        id: `hq-${b.id}`,
        source: hq.id,
        target: b.id,
        type: 'straight',
        animated: true,
        style: { stroke: 'rgba(56,189,248,0.35)', strokeWidth: 1.5 },
      });
    });

    return { nodes, edges };
  }, [branches, items, employees]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, minZoom: 0.65 }}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => router.push(`/branch/${node.id}`)}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="#1e293b" />
        <Controls className="!border-slate-700 !bg-slate-900 [&_button]:!border-slate-700 [&_button]:!bg-slate-800 [&_button]:!fill-slate-300 [&_button:hover]:!bg-slate-700" />
      </ReactFlow>
    </div>
  );
}
