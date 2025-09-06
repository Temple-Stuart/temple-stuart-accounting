import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Temple Stuart Accounting',
  description: 'Premium bookkeeping and automation services',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20 min-h-screen`}>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
