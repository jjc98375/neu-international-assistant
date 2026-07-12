import Link from "next/link";
import Image from "next/image";
import { MessageCircle, Globe } from "lucide-react";

export default function Home() {
  return (
    <div className="max-w-3xl mx-auto py-16 space-y-10">
      <div>
        <Image
          src="/images/husky.jpg"
          alt="Northeastern husky mascot"
          width={64}
          height={64}
          priority
          className="h-16 w-16 rounded-full object-cover ring-2 ring-red-500/70 mb-4"
        />
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
          <span className="text-red-600 dark:text-red-400">NEU</span> International Assistant
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400">
          Ask about visas, billing, employment, arrival, scholarships, forms, and more —
          answered from Northeastern&apos;s Office of Global Services documents, with a live
          fallback to northeastern.edu when the corpus can&apos;t answer.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/assistant"
          className="group bg-white dark:bg-[#161c2d] border border-slate-200 dark:border-[#243049] rounded-xl p-6 hover:border-red-300 dark:hover:border-red-500/50 hover:shadow-md transition-all"
        >
          <MessageCircle className="w-8 h-8 text-red-600 mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1 group-hover:text-red-700">
            Open the Assistant
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Retrieval-augmented answers across 8 categories, sourced from OGS PDFs.
          </p>
        </Link>

        <div className="bg-white dark:bg-[#161c2d] border border-slate-200 dark:border-[#243049] rounded-xl p-6">
          <Globe className="w-8 h-8 text-red-600 mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Grounded &amp; current
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Answers cite their sources; when the documents fall short, a domain-restricted
            web search on northeastern.edu fills the gap.
          </p>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-300">
        <strong>Heads-up:</strong> This assistant provides general guidance from public NEU
        resources. For official immigration or financial decisions, confirm with the Office
        of Global Services.
      </div>
    </div>
  );
}
