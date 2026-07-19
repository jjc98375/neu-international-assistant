import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const NAV_CAMPUSES = [
  { key: "boston", label: "Boston" },
  { key: "silicon-valley", label: "Silicon Valley" },
  { key: "seattle", label: "Seattle" },
  { key: "vancouver", label: "Vancouver" },
  { key: "toronto", label: "Toronto" },
  { key: "london", label: "London" },
];

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
          <header className="fixed top-0 inset-x-0 z-50 bg-[#12172a]/85 backdrop-blur-md border-b border-white/10">
            <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3 group">
                <Image
                  src="/images/neu-seal.png"
                  alt="Northeastern University seal"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover bg-white ring-1 ring-white/30 group-hover:ring-red-500/70 transition-shadow"
                />
                <span className="leading-tight">
                  <span className="block font-mono font-bold tracking-[0.15em] text-sm sm:text-base text-white uppercase">
                    NEU International Student Assistant
                  </span>
                  <span className="block font-mono text-[10px] tracking-[0.25em] text-slate-400 uppercase">
                    Global Campus Network
                  </span>
                </span>
              </Link>
              <nav className="ml-auto flex items-center gap-2">
                {/* Full campus rail on wide screens */}
                <div className="hidden lg:flex items-center">
                  {NAV_CAMPUSES.map((c, i) => (
                    <span key={c.key} className="flex items-center">
                      {i > 0 && (
                        <span aria-hidden className="mx-1 h-1 w-1 rounded-full bg-white/25" />
                      )}
                      <Link
                        href={`/#${c.key}`}
                        className="px-2 py-1.5 rounded-full font-mono text-[11px] tracking-[0.15em] uppercase text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        {c.label}
                      </Link>
                    </span>
                  ))}
                </div>
                {/* Collapsed fallback below lg */}
                <Link
                  href="/#campuses"
                  className="hidden sm:block lg:hidden px-3 py-1.5 rounded-full font-mono text-xs tracking-widest uppercase text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Campuses
                </Link>
                <Link
                  href="/assistant"
                  className="px-4 py-1.5 rounded-full font-mono text-xs tracking-widest uppercase bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-[0_0_12px_rgba(220,38,38,0.5)]"
                >
                  AI Assistant
                </Link>
              </nav>
            </div>
          </header>

          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
