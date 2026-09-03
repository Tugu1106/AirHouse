import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import {
  getAiConfig,
  getCandidateModels,
  AI_TOOLS,
  AI_WRITE_TOOLS,
  WRITE_TOOL_NAMES,
  summarizeWrite,
  runTool,
} from '@/lib/ai';

const ALL_TOOLS = [...AI_TOOLS, ...AI_WRITE_TOOLS];

export const dynamic = 'force-dynamic';

const SYSTEM = `You are AirHouse Assistant, a helper inside an internal IT asset tracker for Airlink.

CRITICAL — NO MADE-UP DATA: You have ZERO built-in knowledge of Airlink's real branches, employees,
or items. The tools are the ONLY source of truth. Before you name, list, count, or describe ANY
branch, employee, or item, you MUST call the matching read tool in this same turn and use ONLY what
it returns. NEVER invent, guess, or fill in example data — no fake models, serials, names, counts, or
table rows. If a tool returns an empty list, say there are none. If you did not call the tool, do not
answer with data.

You can also PROPOSE changes: add an employee, add an item, or transfer an item. When the user asks
for a change, call the matching tool; the app asks the user to CONFIRM before it runs.
Do ONE change per turn: if the user asks for several changes (e.g. add an employee AND their laptop),
handle them one at a time and wait for each confirmation before proposing the next.
When you add an item that belongs to a person, ALWAYS set assignedTo to that person's exact name —
never leave it out and never assign it to yourself or the admin. Deleting is not available.
Be concise, use short markdown tables for lists, and always respond with text.`;

interface ChatMessage {
  role: string;
  content?: string | null;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  }

  const cfg = getAiConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: 'AI is not configured yet. Set AI_API_KEY on the server to enable it.' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const incoming: { role: string; content: string }[] = Array.isArray(body?.messages)
    ? body.messages
    : [];

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM },
    ...incoming.slice(-20).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? ''),
    })),
  ];

  const candidates = await getCandidateModels(cfg);
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No usable AI models are available.' }, { status: 502 });
  }

  const usedTools: string[] = [];
  let modelIdx = 0; // sticks to the first model that works; rotates on failure

  // A model error we should retry on the NEXT model (dead free tier, rate limit,
  // no tool support). Auth/other errors are surfaced as-is.
  const shouldRotate = (status: number, body: string) =>
    status === 402 ||
    status === 404 ||
    status === 429 ||
    (status === 400 && /tool/i.test(body)) ||
    /no endpoints|not a valid model|unavailable|rate.?limit/i.test(body);

  /** Call the model, rotating to the next candidate on retryable failures. */
  async function complete(): Promise<ChatMessage> {
    let lastErr = 'no models available';
    for (; modelIdx < candidates.length; modelIdx++) {
      const res = await fetch(cfg!.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg!.key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://airhouse.local',
          'X-Title': 'AirHouse',
        },
        body: JSON.stringify({
          model: candidates[modelIdx],
          messages,
          tools: ALL_TOOLS,
          tool_choice: 'auto',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const msg: ChatMessage | undefined = data?.choices?.[0]?.message;
        if (msg) return msg;
        lastErr = 'empty response';
        continue;
      }

      const body = (await res.text()).slice(0, 300);
      lastErr = `(${res.status}) ${body}`;
      if (shouldRotate(res.status, body)) continue; // try the next model
      throw new Error(lastErr); // auth / non-model error → stop
    }
    throw new Error(`All models failed. Last error: ${lastErr}`);
  }

  try {
    for (let step = 0; step < 6; step++) {
      const msg = await complete();
      messages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // A write proposal → stop and ask the user to confirm (don't execute).
        const writeCall = msg.tool_calls.find((c) => WRITE_TOOL_NAMES.has(c.function.name));
        if (writeCall) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(writeCall.function.arguments || '{}');
          } catch {
            /* leave empty */
          }
          return NextResponse.json({
            reply: (msg.content ?? '').trim() || 'Please confirm this change:',
            pending: { tool: writeCall.function.name, args, summary: summarizeWrite(writeCall.function.name, args) },
            model: candidates[modelIdx],
          });
        }

        for (const call of msg.tool_calls) {
          usedTools.push(call.function.name);
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || '{}');
          } catch {
            /* leave empty */
          }
          let result: unknown;
          try {
            result = await runTool(call.function.name, args);
          } catch (e) {
            result = { error: e instanceof Error ? e.message : 'tool failed' };
          }
          messages.push({
            role: 'tool',
            // @ts-expect-error tool_call_id is part of the OpenAI tool message shape
            tool_call_id: call.id,
            content: JSON.stringify(result).slice(0, 8000),
          });
        }
        continue; // let the model read the results and continue
      }

      const reply =
        (msg.content ?? '').trim() ||
        "I can only look things up right now (branches, employees, items) — I can't add or change anything yet. What would you like me to find?";
      return NextResponse.json({
        reply,
        tools: [...new Set(usedTools)],
        model: candidates[modelIdx],
      });
    }

    return NextResponse.json({
      reply: 'Sorry — I got stuck looking that up. Try rephrasing?',
      tools: [...new Set(usedTools)],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'AI request error' },
      { status: 500 },
    );
  }
}
