import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const ibmMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Temple Stuart | Personal Back Office",
  description: "Track your money. Plan your trips. Find your people.",
  openGraph: {
    title: "Temple Stuart | Personal Back Office",
    description: "Track your money. Plan your trips. Find your people.",
    url: "https://templestuart.com",
    siteName: "Temple Stuart",
    images: [
      {
        url: "https://templestuart.com/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Temple Stuart - Personal Back Office",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Temple Stuart | Personal Back Office",
    description: "Track your money. Plan your trips. Find your people.",
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
