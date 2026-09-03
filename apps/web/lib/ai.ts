// AI assistant backend — model-agnostic (any OpenAI-compatible endpoint).
// Configure with env: AI_API_KEY (required), AI_API_URL, AI_MODEL.
// Read-only for now: the tools only list/search data, never modify it.

import { listBranches, listEmployees, listItems, listItemTypes } from '@airlink/core';

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

// Last-resort candidates if the live catalog can't be fetched. Free models come
// and go, so these are only a safety net — the live list is preferred.
const FALLBACK_MODELS = [
  'openai/gpt-oss-20b:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];

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

/** Ordered list of models to try: pinned first, then live free+tool models. */
export async function getCandidateModels(cfg: AiConfig): Promise<string[]> {
  const dynamic = await freeToolModelIds(cfg);
  const list = [cfg.pinnedModel, ...dynamic, ...FALLBACK_MODELS].filter(Boolean) as string[];
  return [...new Set(list)];
}

// OpenAI-style tool schemas (OpenRouter is OpenAI-compatible). Read-only.
export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_branches',
      description: 'List all branches with their names.',
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
        'List or search inventory items. Filter by branch name, item type key, status, or a free-text search over serial/model.',
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
      return branches.map((b) => ({ name: b.name, branchNo: b.branch_no }));

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
      return items.slice(0, 60).map((i) => ({
        type: i.type,
        model: i.properties?.model ?? null,
        system_name: i.properties?.system_name ?? null,
        serial: i.properties?.serial ?? null,
        branch: i.branch?.name ?? null,
        assignedTo: i.assignee?.name ?? null,
        status: i.status,
      }));
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
