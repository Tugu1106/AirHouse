import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Airlink Asset Tracker',
  description: 'IT asset tracking for Airlink Mongolia',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
