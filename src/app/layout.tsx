import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner"
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Allo Inventory | Real-Time Stock & Reservation Terminal",
  description: "Secure, high-concurrency warehouse inventory gateway built with atomic locks, idempotency verification, and real-time synchronization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-surface-bg text-text-primary">
        {/* Premium Sticky Nav */}
        <nav className="sticky top-0 z-50 w-full border-b border-border-subtle bg-surface-bg/85 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
            {/* Wordmark and square mark */}
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-brand-indigo rounded-sm shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
              <span className="font-heading text-lg font-bold tracking-tight text-white select-none">
                Allo
              </span>
            </div>
            {/* Right inventory label */}
            <div className="text-xs font-mono tracking-wider text-text-secondary bg-surface-card/65 px-3 py-1 rounded-full border border-border-subtle">
              INVENTORY SYSTEM
            </div>
          </div>
        </nav>
        
        {/* Main Content with subtle top padding below navbar */}
        <div className="flex-1 flex flex-col pt-4">
          {children}
        </div>
        
        <Toaster theme="dark" closeButton position="top-right" />
      </body>
    </html>
  );
}
