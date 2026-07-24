import { AppProviders } from '@/components/AppProviders';

// The shell (header + nav) renders immediately; the DataProvider loads the data
// bundle client-side and pages show skeletons until it arrives. No server-side
// data fetch blocks the first paint.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
