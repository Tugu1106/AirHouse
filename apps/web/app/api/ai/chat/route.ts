import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getAiConfig, AI_TOOLS, runTool } from '@/lib/ai';

export const dynamic = 'force-dynamic';

const SYSTEM = `You are AirHouse Assistant, a helper inside an internal IT asset tracker for Airlink.
Answer the admin's questions about inventory items, employees, and branches.
Always use the tools to look up real data before answering — never guess or invent details.
Be concise and factual; use short lists or a sentence, not walls of text.
You can only READ data right now — you cannot add, edit, transfer, or delete anything.`;

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

  const usedTools: string[] = [];

  try {
    for (let step = 0; step < 6; step++) {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://airhouse.local',
          'X-Title': 'AirHouse',
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          tools: AI_TOOLS,
          tool_choice: 'auto',
        }),
      });

      if (!res.ok) {
        const detail = (await res.text()).slice(0, 400);
        return NextResponse.json(
          { error: `AI request failed (${res.status}). ${detail}` },
          { status: 502 },
        );
      }

      const data = await res.json();
      const msg: ChatMessage | undefined = data?.choices?.[0]?.message;
      if (!msg) return NextResponse.json({ error: 'AI returned no message.' }, { status: 502 });

      messages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length > 0) {
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

      return NextResponse.json({ reply: msg.content ?? '', tools: [...new Set(usedTools)] });
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
