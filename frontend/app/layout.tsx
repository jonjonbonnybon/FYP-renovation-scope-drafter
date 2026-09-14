// Root layout — sets up fonts and global meta.
// next/font/google handles font subsetting + self-hosting automatically,
// see: https://nextjs.org/docs/app/building-your-application/optimizing/fonts

import type { Metadata } from "next";
import { Outfit, Libre_Franklin } from "next/font/google";
import "./globals.css";

// Outfit — geometric sans for headings
// https://fonts.google.com/specimen/Outfit
const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

// Libre Franklin — body text. 
// https://fonts.google.com/specimen/Libre+Franklin
const libreFranklin = Libre_Franklin({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

// metadata export for the <head> — Next.js handles this server-side
// https://nextjs.org/docs/app/api-reference/functions/generate-metadata
export const metadata: Metadata = {
  title: "Renovation Scope Drafter — Site Survey to Scope of Work",
  description:
    "Upload site photos and voice notes to automatically draft a renovation scope of work. Built for contractors and project managers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${libreFranklin.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
