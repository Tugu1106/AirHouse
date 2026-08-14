import { getActivityPage, ACTIVITY_PAGE_SIZE } from '@/lib/activity';
import { ActivityView } from '@/components/ActivityView';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const rows = await getActivityPage(0, ACTIVITY_PAGE_SIZE);
  return (
    <ActivityView
      initialRows={rows}
      pageSize={ACTIVITY_PAGE_SIZE}
      initialHasMore={rows.length === ACTIVITY_PAGE_SIZE}
    />
  );
}
