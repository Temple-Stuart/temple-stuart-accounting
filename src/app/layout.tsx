import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { SITE_DESCRIPTION } from "@/lib/brandLines";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const ibmMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});

// PR-Mobile2: viewport-fit=cover so env(safe-area-inset-*) resolves on phones (the
// mobile bottom tab bar uses it to sit above the home indicator). width/initial-scale
// match Next's defaults — additive, no visual change on desktop.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// FOUNDERS-POSITIONING-AND-OG-TRUTH: the link-preview metadata previously served
// stale copy ("Plan your trips. Find your people.") contradicting the live hero
// (page.tsx: "Track your money. Plan your time. Live smarter."). Description now
// mirrors the real hero + the founder positioning; claims are only what is true
// (nine modules — the nine TABS — and Plaid bank sync; no "IRS compliant", no
// "AI powered" headline). "Founder's Back Office" is BRAND COPY only — the
// Personal/Business/Trading ENTITY vocabulary (data model) is untouched.
// HOME-LINES-01, 2026-11-08: the description is the company line and the hero's subline, from src/lib/brandLines.ts; 'Nine modules' left — the app has six tabs
// OG-CREST-01 (Alex, 2026-11-12): "instead of founders back office... i want it to say : Connect, Create, Control" — the
// three titles end in his three words ("Founder's Back Office" until then). The card iMessage drew for "Temple Stuart —
// Founder's Back Office" read "Founder's Back Office" (his screenshot), so this one should read "Connect, Create, Control". The
// picture is the hero's crest now (src/app/opengraph-image.tsx), so the alt says what it shows, in that file's words.
export const metadata: Metadata = {
  title: "Temple Stuart | Connect, Create, Control",
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "Temple Stuart — Connect, Create, Control",
    description: SITE_DESCRIPTION,
    url: "https://templestuart.com",
    siteName: "Temple Stuart",
    images: [
      {
        url: "https://templestuart.com/opengraph-image",
        width: 1200,
        height: 630,
        alt: "The Temple Stuart crest: a gold lion on a shield, on a violet ground",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Temple Stuart — Connect, Create, Control",
    description: SITE_DESCRIPTION,
    images: ["https://templestuart.com/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${ibmMono.variable}`}>
      <body className={`${inter.className} bg-white min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
