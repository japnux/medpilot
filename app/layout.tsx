import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Police Inter pour toute l'application (UI médicale sobre)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-200">
        {children}
      </body>
    </html>
  );
}
