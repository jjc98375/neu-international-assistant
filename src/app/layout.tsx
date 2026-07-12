import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { ThemeProvider, ThemeToggle } from "@/components/ThemeProvider";
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
  title: "NEU International Assistant",
  description:
    "AI assistant for Northeastern international students — visas, billing, employment, arrival, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-slate-100 dark:bg-[#0d1117] text-slate-900 dark:text-slate-100 min-h-screen">
        <ThemeProvider>
          <header className="bg-white dark:bg-[#161c2d] border-b border-slate-200 dark:border-[#243049] sticky top-0 z-30">
            <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center gap-2.5 font-bold text-lg text-slate-900 dark:text-slate-100"
              >
                <Image
                  src="/images/husky.jpg"
                  alt="Northeastern husky mascot"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-red-500/70"
                />
                <span>
                  NEU <span className="text-red-600 dark:text-red-400">International Assistant</span>
                </span>
              </Link>
              <nav className="flex gap-1">
                <Link
                  href="/assistant"
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-[#1e2537] transition-colors"
                >
                  Assistant
                </Link>
              </nav>
              <ThemeToggle />
            </div>
          </header>

          <div className="max-w-screen-xl mx-auto px-4 py-6">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
