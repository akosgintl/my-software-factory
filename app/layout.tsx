import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Libre_Franklin, Courier_Prime } from 'next/font/google';
import './globals.css';

// Both faces are downloaded at build time and served from this app; no font request leaves the machine at runtime.
const sans = Libre_Franklin({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' });
const typed = Courier_Prime({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], variable: '--font-typed', display: 'swap' });

export const metadata: Metadata = {
  title: 'Reminders',
  description: 'Your chat reminders: scan, create, change and remove them. Chat, this page and the reminder checker share one database.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1f4a3d',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${typed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
