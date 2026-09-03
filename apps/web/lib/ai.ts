// AI assistant backend — model-agnostic (any OpenAI-compatible endpoint).
// Configure with env: AI_API_KEY (required), AI_API_URL, AI_MODEL.
// Read-only for now: the tools only list/search data, never modify it.

import {
  listBranches,
  listEmployees,
  listItems,
  listItemTypes,
  getItemType,
  createEmployee,
  addItem,
  transferItem,
  type ActorContext,
} from '@airlink/core';

export interface AiConfig {
  url: string;
  key: string;
  /** Optional pinned model (AI_MODEL); tried first, then rotation kicks in. */
  pinnedModel?: string;
}

/** Returns the AI config, or null if no key is set (feature stays dormant). */
export function getAiConfig(): AiConfig | null {
  const key = process.env.AI_API_KEY;
  if (!key) return null;
  return {
    url: process.env.AI_API_URL || 'https://openrouter.ai/api/v1/chat/completions',
    key,
    pinnedModel: process.env.AI_MODEL?.trim() || undefined,
  };
}

// Prefer strong, well-known families (in this order) among the live free models.
const PREFERRED_FAMILIES = [
  'deepseek',
  'qwen',
  'moonshot', // Kimi
  'kimi',
  'mistral',
  'z-ai', // GLM
  'glm',
  'meta-llama',
  'google', // Gemini
];

// Last-resort candidates if the live catalog can't be fetched. Only a safety net.
const FALLBACK_MODELS = [
  'deepseek/deepseek-chat-v3-0324:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'moonshotai/kimi-k2:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];

const familyRank = (id: string) => {
  const i = PREFERRED_FAMILIES.findIndex((p) => id.toLowerCase().includes(p));
  return i === -1 ? PREFERRED_FAMILIES.length : i;
};

const isZeroPrice = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n === 0;
};

let catalog: { at: number; ids: string[] } | null = null;
const CATALOG_TTL_MS = 15 * 60 * 1000;

/**
 * Live list of OpenRouter models that are FREE and support tool-calling, newest
 * account-available first. Cached 15 min. Falls back to FALLBACK_MODELS.
 */
async function freeToolModelIds(cfg: AiConfig): Promise<string[]> {
  if (catalog && Date.now() - catalog.at < CATALOG_TTL_MS) return catalog.ids;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models/user?output_modalities=text', {
      headers: { Authorization: `Bearer ${cfg.key}`, 'X-Title': 'AirHouse' },
    });
    if (res.ok) {
      const data = await res.json();
      const rows: unknown[] = Array.isArray(data?.data) ? data.data : [];
      const ids = rows
        .map((m) => m as Record<string, unknown>)
        .filter((m) => typeof m.id === 'string' && (m.id as string).endsWith(':free'))
        .filter(
          (m) =>
            Array.isArray(m.supported_parameters) &&
            (m.supported_parameters as unknown[]).includes('tools'),
        )
        .filter((m) => {
          const p = m.pricing as Record<string, unknown> | undefined;
          return !p || (isZeroPrice(p.prompt) && isZeroPrice(p.completion));
        })
        .map((m) => m.id as string);
      if (ids.length) {
        catalog = { at: Date.now(), ids };
        return ids;
      }
    }
  } catch {
    /* fall through to the safety net */
  }
  return FALLBACK_MODELS;
}

/**
 * Ordered models to try: pinned first, then live free+tool models with the
 * strong families ranked first — but every free model is KEPT as a fallback,
 * so if the "strong" ones aren't actually free right now we still reach a
 * working one instead of failing.
 */
export async function getCandidateModels(cfg: AiConfig): Promise<string[]> {
  const dynamic = await freeToolModelIds(cfg);
  const ranked = [...dynamic].sort((a, b) => familyRank(a) - familyRank(b));
  const list = [cfg.pinnedModel, ...ranked, ...FALLBACK_MODELS].filter(Boolean) as string[];
  return [...new Set(list)].slice(0, 12);
}

// OpenAI-style tool schemas (OpenRouter is OpenAI-compatible). Read-only.
export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_branches',
      description:
        'List all branches. The headquarters (a.k.a. HQ / central / head branch) is marked with "headquarters": true.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_item_types',
      description: 'List the supported item types (desktop, laptop, monitor, etc.).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_employees',
      description: 'List employees. Optionally filter by branch name.',
      parameters: {
        type: 'object',
        properties: { branch: { type: 'string', description: 'Branch name to filter by' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_items',
      description:
        'List or search inventory items. Filter by branch name, item type key, status, or free text. Each item includes its full specs (model, system_name, cpu, ram, storage, os, …) so you can answer questions about RAM, CPU, storage, etc.',
      parameters: {
        type: 'object',
        properties: {
          branch: { type: 'string', description: 'Branch name to filter by' },
          type: { type: 'string', description: 'Item type key, e.g. desktop, laptop' },
          status: { type: 'string', description: 'active, in_repair, retired, or lost' },
          search: { type: 'string', description: 'free text (serial, model, etc.)' },
        },
      },
    },
  },
] as const;

type Args = Record<string, unknown>;
const s = (v: unknown) => (v == null ? undefined : String(v));

/** Execute a read-only tool and return concise, model-friendly JSON. */
export async function runTool(name: string, args: Args): Promise<unknown> {
  const branches = await listBranches();
  const branchIdByName = (n?: string) =>
    n ? branches.find((b) => b.name.toLowerCase() === n.toLowerCase())?.id : undefined;

  switch (name) {
    case 'list_branches':
      return branches.map((b) => ({
        name: b.name,
        branchNo: b.branch_no,
        ...(b.is_hq ? { headquarters: true } : {}),
      }));

    case 'list_item_types':
      return listItemTypes().map((t) => ({ key: t.key, label: t.label }));

    case 'list_employees': {
      const emps = await listEmployees(branchIdByName(s(args.branch)));
      return emps.map((e) => ({
        name: e.name,
        position: e.position,
        phone: e.phone,
        branch: branches.find((b) => b.id === e.branch_id)?.name ?? null,
        status: e.status,
      }));
    }

    case 'list_items': {
      const items = await listItems({
        branchId: branchIdByName(s(args.branch)),
        type: s(args.type),
        status: s(args.status) as never,
        search: s(args.search),
      });
      // Spread the full properties (model, system_name, cpu, ram, storage, os,
      // serial, …) so the model can filter/answer on any spec.
      return items.slice(0, 80).map((i) => ({
        ...(i.properties as Record<string, unknown>),
        type: i.type,
        branch: i.branch?.name ?? null,
        assignedTo: i.assignee?.name ?? null,
        status: i.status,
      }));
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// --- Write tools (require confirmation before they run) ---------------------

export const AI_WRITE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_employee',
      description: 'Create a new employee. Requires a name; branch/position/status optional.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          branch: { type: 'string', description: 'branch name' },
          position: {
            type: 'string',
            description: 'Developer, Ecommerce, HR manager, or Agent',
          },
          status: { type: 'string', description: 'active, trial, pregnancy_leave, or fired' },
          phone: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_item',
      description: 'Add a new inventory item (asset) to a branch. Requires type and branch.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'type key: desktop, laptop, monitor, mouse, keyboard, printer, cable, lan_switch',
          },
          branch: { type: 'string', description: 'branch name' },
          assignedTo: { type: 'string', description: 'employee name to assign it to (optional)' },
          model: { type: 'string' },
          serial: { type: 'string' },
          system_name: { type: 'string' },
          cpu: { type: 'string' },
          ram: { type: 'string' },
          storage: { type: 'string' },
          os: { type: 'string' },
        },
        required: ['type', 'branch'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transfer_item',
      description:
        'Transfer/reassign an item to a different employee and/or branch. Identify the item by its model or system name (e.g. "MacBook", "PC-014"). If that name is not unique, also pass its current owner or branch to disambiguate.',
      parameters: {
        type: 'object',
        properties: {
          item: {
            type: 'string',
            description: 'model, system name, or serial that identifies the item',
          },
          currentOwner: { type: 'string', description: 'current owner name, to disambiguate (optional)' },
          currentBranch: { type: 'string', description: 'current branch, to disambiguate (optional)' },
          toEmployee: {
            type: 'string',
            description: 'employee name to assign to (omit or empty to unassign)',
          },
          toBranch: { type: 'string', description: 'branch name to move it to (optional)' },
        },
        required: ['item'],
      },
    },
  },
] as const;

export const WRITE_TOOL_NAMES = new Set<string>(AI_WRITE_TOOLS.map((t) => t.function.name));

/** A human-readable summary of a proposed write, shown on the confirm card. */
export function summarizeWrite(name: string, a: Args): string {
  const g = (k: string) => (a[k] == null || a[k] === '' ? '' : String(a[k]));
  if (name === 'add_employee') {
    return `Add employee “${g('name')}”${g('position') ? ` (${g('position')})` : ''}${
      g('branch') ? ` to ${g('branch')}` : ''
    }`;
  }
  if (name === 'add_item') {
    const label = getItemType(g('type'))?.label ?? g('type');
    return `Add ${label}${g('model') ? ` “${g('model')}”` : ''}${
      g('serial') ? ` (SN ${g('serial')})` : ''
    } to ${g('branch')} — ${g('assignedTo') ? `assigned to ${g('assignedTo')}` : 'unassigned'}`;
  }
  if (name === 'transfer_item') {
    return `Transfer ${g('item')}${g('currentOwner') ? ` (from ${g('currentOwner')})` : ''}${
      g('toEmployee') ? ` to ${g('toEmployee')}` : ' (unassign)'
    }${g('toBranch') ? `, branch → ${g('toBranch')}` : ''}`;
  }
  return `Run ${name}`;
}

export interface WriteResult {
  ok: boolean;
  message: string;
  link?: { href: string; label: string };
}

/** Execute a confirmed write with the admin's actor context. */
export async function runWriteTool(
  name: string,
  args: Args,
  ctx: ActorContext,
): Promise<WriteResult> {
  const branches = await listBranches();
  const branchByName = (n?: string) =>
    n ? branches.find((b) => b.name.toLowerCase() === n.toLowerCase()) : undefined;

  try {
    if (name === 'add_employee') {
      const branchName = s(args.branch);
      const branch = branchByName(branchName);
      if (branchName && !branch) return { ok: false, message: `No branch named “${branchName}”.` };
      const emp = await createEmployee(
        {
          name: String(args.name),
          branchId: branch?.id ?? null,
          position: s(args.position) ?? null,
          status: (s(args.status) as never) || undefined,
          phone: s(args.phone) ?? null,
        },
        ctx,
      );
      return {
        ok: true,
        message: `✓ Added employee ${emp.name}.`,
        link: { href: `/employees/${emp.id}`, label: `Open ${emp.name}` },
      };
    }

    if (name === 'add_item') {
      const branch = branchByName(s(args.branch));
      if (!branch) return { ok: false, message: `No branch named “${s(args.branch)}”.` };
      const def = getItemType(String(args.type));
      if (!def) return { ok: false, message: `Unknown item type “${s(args.type)}”.` };
      let assignedTo: string | null = null;
      const assignName = s(args.assignedTo);
      if (assignName) {
        const emps = await listEmployees(branch.id);
        const emp = emps.find((e) => e.name.toLowerCase() === assignName.toLowerCase());
        if (!emp) return { ok: false, message: `No employee “${assignName}” in ${branch.name}.` };
        assignedTo = emp.id;
      }
      const props: Record<string, string> = {};
      for (const k of ['model', 'serial', 'system_name', 'cpu', 'ram', 'storage', 'os']) {
        const v = s(args[k]);
        if (v) props[k] = v;
      }
      const created = await addItem(
        { type: def.key, branch_id: branch.id, assigned_to: assignedTo, status: 'active', properties: props },
        ctx,
      );
      return {
        ok: true,
        message: `✓ Added ${def.label} to ${branch.name}.`,
        link: { href: `/item/${created.id}`, label: 'Open item' },
      };
    }

    if (name === 'transfer_item') {
      const term = s(args.item) ?? '';
      let pick = await listItems({ search: term });
      const owner = s(args.currentOwner);
      if (owner) {
        pick = pick.filter((i) => (i.assignee?.name ?? '').toLowerCase() === owner.toLowerCase());
      }
      const curBranch = s(args.currentBranch);
      if (curBranch) {
        pick = pick.filter((i) => (i.branch?.name ?? '').toLowerCase() === curBranch.toLowerCase());
      }
      if (pick.length === 0) return { ok: false, message: `No item matching “${term}”.` };
      if (pick.length > 1)
        return {
          ok: false,
          message: `Several items match “${term}” — say the current owner or branch to pick one.`,
        };
      const item = pick[0]!;
      const input: { toEmployeeId?: string | null; toBranchId?: string } = {};
      const toBranch = s(args.toBranch);
      if (toBranch) {
        const b = branchByName(toBranch);
        if (!b) return { ok: false, message: `No branch named “${toBranch}”.` };
        input.toBranchId = b.id;
      }
      if ('toEmployee' in args) {
        const toEmp = s(args.toEmployee);
        if (toEmp) {
          const emps = await listEmployees();
          const emp = emps.find((e) => e.name.toLowerCase() === toEmp.toLowerCase());
          if (!emp) return { ok: false, message: `No employee named “${toEmp}”.` };
          input.toEmployeeId = emp.id;
        } else {
          input.toEmployeeId = null;
        }
      }
      await transferItem(item.id, input, ctx);
      return {
        ok: true,
        message: `✓ Transferred ${getItemType(item.type)?.label ?? item.type}.`,
        link: { href: `/item/${item.id}`, label: 'Open item' },
      };
    }

    return { ok: false, message: `Unknown action: ${name}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Action failed.' };
  }
}
