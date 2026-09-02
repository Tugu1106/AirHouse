// AI assistant backend — model-agnostic (any OpenAI-compatible endpoint).
// Configure with env: AI_API_KEY (required), AI_API_URL, AI_MODEL.
// Read-only for now: the tools only list/search data, never modify it.

import { listBranches, listEmployees, listItems, listItemTypes } from '@airlink/core';

export interface AiConfig {
  url: string;
  key: string;
  model: string;
}

/** Returns the AI config, or null if no key is set (feature stays dormant). */
export function getAiConfig(): AiConfig | null {
  const key = process.env.AI_API_KEY;
  if (!key) return null;
  return {
    url: process.env.AI_API_URL || 'https://openrouter.ai/api/v1/chat/completions',
    key,
    // Any OpenRouter model that supports tool-calling. Override with AI_MODEL.
    model: process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
  };
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
