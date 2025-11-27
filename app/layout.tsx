import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Black Friday 2024 - Name Your Need | AudicoOnline",
  description: "Get exclusive Black Friday deals at cost + 15%. Search for any audio/visual product and pay instantly. Limited time only!",
  keywords: ["black friday", "audio", "visual", "deals", "south africa", "audico", "hi-fi", "speakers", "amplifiers"],
  openGraph: {
    title: "Black Friday 2024 - Name Your Need | AudicoOnline",
    description: "Get exclusive Black Friday deals at cost + 15%. Search for any audio/visual product and pay instantly.",
    type: "website",
    locale: "en_ZA",
    siteName: "AudicoOnline",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
