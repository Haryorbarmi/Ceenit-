import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });

const helvena = localFont({
  src: [
    { path: './fonts/Helvena-Semibold.woff2', weight: '600', style: 'normal' },
    { path: './fonts/Helvena-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-heading',
});

export const metadata: Metadata = {
  title: 'Ceeneet · USDT payments, confirmed.',
  description: 'Pay a seller in USDT. Ceeneet confirms it on the blockchain.',
  // Payment pages are private to the buyer and seller. Keep them out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${helvena.variable}`}>
      <body>{children}</body>
    </html>
  );
}
