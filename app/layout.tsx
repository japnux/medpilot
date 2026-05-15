import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter au plus proche de Sohne (Stripi-inspired design system).
// Weights utilisés : 300 (display + body), 400 (boutons, captions), 500 (titres).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "MedPilot — Suivi médical familial",
  description:
    "Application open source de suivi médical oncologique familial : analyse de documents, biologie, consultations, timeline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
