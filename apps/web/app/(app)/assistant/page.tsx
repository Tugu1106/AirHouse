import { AiChat } from '@/components/AiChat';

// Admin-only (the whole (app) group is admin-gated in the layout).
export default function AssistantPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-6">
      <AiChat />
    </main>
  );
}
