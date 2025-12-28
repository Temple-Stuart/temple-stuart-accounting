import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Temple Stuart OS",
  description: "Track your money. Plan your trips. Find your people.",
  openGraph: {
    title: "Temple Stuart OS",
    description: "Track your money. Plan your trips. Find your people.",
    url: "https://templestuart.com",
    siteName: "Temple Stuart",
    images: [
      {
        url: "https://templestuart.com/api/og/home",
        width: 1200,
        height: 630,
        alt: "Temple Stuart OS - Financial infrastructure for independent professionals",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Temple Stuart OS",
    description: "Track your money. Plan your trips. Find your people.",
    images: ["https://templestuart.com/api/og/home"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
