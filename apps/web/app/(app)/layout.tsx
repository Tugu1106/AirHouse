import { loadDataBundle } from '@/lib/data';
import { AppProviders } from '@/components/AppProviders';

// Loads the whole data bundle ONCE per full page load, then hands it to the
// client provider. Because this layout is shared, client-side navigation
// between dashboard / branch / employees does NOT re-run it — switching views
// is instant and hits the database zero times until a write triggers refresh().
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const initial = await loadDataBundle();
  return <AppProviders initial={initial}>{children}</AppProviders>;
}
