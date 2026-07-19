"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowDownLeft,
  ChevronRight,
  ChevronLeft,
  MapPin,
  MessageCircle,
  ExternalLink,
} from "lucide-react";

const CAMPUSES = [
  {
    key: "boston",
    name: "Boston",
    region: "Massachusetts, USA",
    images: ["/campuses/boston.jpg", "/campuses/boston-2.jpg"],
    location:
      "Huntington Avenue, in the heart of Boston's Fenway/Roxbury neighborhoods — the flagship campus and home of the Office of Global Services.",
    programs: [
      "MS Computer Science",
      "Align MSCS (career-change bridge)",
      "MS Information Systems",
      "MBA (D'Amore-McKim)",
      "PhD & doctoral programs",
    ],
    offers:
      "The full breadth of Northeastern: every college, the co-op program's global headquarters, on-campus housing, D1 athletics, and the main OGS office for visas and immigration paperwork.",
    facilities:
      "Anchored by the 234,000 sq ft Interdisciplinary Science and Engineering Complex (ISEC) — a $225M building that opened in 2017 — across a campus built into Fenway/Roxbury with its own housing and research labs.",
    tuition:
      "Graduate tuition is charged per credit and varies by college — roughly $1,700–$2,000 USD per credit for most master's programs.",
    scholarships:
      "Every graduate applicant is automatically considered for merit aid at admission. Named awards include the Double Husky (25% off for Northeastern alumni), Full Circle, Parent & Family, and African Students Access scholarships, plus assistantships and fellowships for research degrees.",
    coopNote:
      "800+ co-op employer partners network-wide; most students complete one to three six-month, full-time paid co-ops before graduating. Recent MSCS grads have gone to:",
    employers: ["Amazon", "Google", "Meta", "Microsoft", "McKinsey", "Salesforce"],
    website: "https://www.northeastern.edu/campuses/boston/",
  },
  {
    key: "silicon-valley",
    name: "Silicon Valley",
    region: "San Jose, California, USA",
    images: ["/campuses/silicon-valley-neu.jpg", "/campuses/silicon-valley-neu-2.jpg"],
    location:
      "Downtown San Jose, California — walking distance from the headquarters of the world's largest tech companies.",
    programs: ["MS Computer Science", "Align MSCS", "MS Data Science", "MS Information Systems"],
    offers:
      "Graduate computer science and engineering, including the Align MSCS for career-changers, with project-based courses and deep ties to Bay Area employers for co-op and internships.",
    facilities:
      "4 N 2nd Street in downtown San Jose — bright, modern classrooms built for hackathons, meetups, and career workshops, steps from the region that produces more unicorn startups than anywhere else on earth.",
    tuition:
      "Same per-credit graduate rates as Boston for most programs (roughly $1,700–$2,000 USD per credit, program-dependent).",
    scholarships:
      "New MS admits are considered for Khoury and College of Engineering regional campus scholarships (typically ~25% of tuition), and Northeastern alumni get the 25% Double Husky discount. Merit consideration is automatic — no separate application.",
    coopNote: "Students have completed co-ops at:",
    employers: ["Apple", "Nvidia", "Salesforce", "AWS", "NASA"],
    website: "https://siliconvalley.northeastern.edu/",
  },
  {
    key: "seattle",
    name: "Seattle",
    region: "Washington, USA",
    images: ["/campuses/seattle-neu-2.jpg", "/campuses/seattle-neu.jpg"],
    location:
      "South Lake Union, Seattle — surrounded by Amazon's campus and a short ride from Microsoft and the region's cloud-computing corridor.",
    programs: ["MS Computer Science", "Align MSCS", "MS Data Analytics Engineering"],
    offers:
      "Computer science (MSCS and Align MSCS), data and analytics programs, evening-friendly schedules, and a co-op network built around the Pacific Northwest tech industry.",
    facilities:
      "401 Terry Ave N in South Lake Union — a robotics lab, an advanced manufacturing lab, and a Generative AI Research Lab (est. 2023), a block from Amazon's headquarters.",
    tuition:
      "Per-credit graduate tuition in line with Boston rates (roughly $1,700–$2,000 USD per credit, program-dependent).",
    scholarships:
      "Same automatic merit consideration as the other U.S. campuses: Khoury/College of Engineering campus scholarships around 25% for new master's students, and the 25% Double Husky discount for returning alumni.",
    coopNote:
      "Northeastern is Amazon's second-largest Seattle hiring partner, with 1,200+ co-op and internship placements a year, including:",
    employers: ["Amazon", "Microsoft", "Expedia", "Boeing", "Meta", "Salesforce"],
    website: "https://seattle.northeastern.edu/",
  },
  {
    key: "vancouver",
    name: "Vancouver",
    region: "British Columbia, Canada",
    images: ["/campuses/vancouver-neu.jpg", "/campuses/vancouver-neu-2.jpg"],
    location:
      "Downtown Vancouver, British Columbia — a Pacific gateway city consistently ranked among the world's most livable.",
    programs: [
      "Align MSCS",
      "MS Computer Science",
      "MS Information Systems",
      "MS Data Analytics Engineering",
    ],
    offers:
      "The Align MSCS and professional master's programs designed for career-changers, plus Canadian co-op work terms and a path to Canadian post-graduation work permits.",
    facilities:
      "410 West Georgia Street downtown — labs supporting research in AI, extended reality, and computer vision at Canada's only private R1 research university.",
    tuition:
      "Billed in Canadian dollars at rates set for the Canadian campuses — often meaningfully lower than U.S. sticker price after exchange rates.",
    scholarships:
      "The deepest scholarship menu on the network: Canada Domestic & Excellence (25–50%, Canadian citizens/PRs), CAMD Information Design award (40%, open to international students), College of Engineering Global Campus (25%), Liu Kuo-Chun fellowships ($10,000 USD), and a 50% Career Advancement award via employer partners. Awards stack up to 50% of tuition.",
    coopNote:
      "60+ organizations run programming on campus — Vancouver ranks #2 in Canada for AI-talent concentration. Embedded partners include:",
    employers: ["Deloitte", "Amazon", "Microsoft", "Apple", "SAP", "TELUS", "Hootsuite"],
    website: "https://vancouver.northeastern.edu/",
  },
  {
    key: "toronto",
    name: "Toronto",
    region: "Ontario, Canada",
    images: ["/campuses/toronto-neu.jpg", "/campuses/toronto-neu-2.jpg"],
    location:
      "Downtown Toronto, Ontario — Canada's financial capital and North America's fastest-growing tech-talent market.",
    programs: ["MS Analytics", "MS Information Systems", "MS Project Management", "Align MSCS"],
    offers:
      "Professional graduate programs in analytics, project management, information systems, and computer science, with Canadian work-integrated learning and PGWP eligibility.",
    facilities:
      "375 Queen Street West — modern learning spaces plus wellness and multi-faith rooms, in Canada's centre of finance, life sciences, and technology.",
    tuition:
      "Billed in Canadian dollars; professional master's programs are priced per program — check the program page for the exact CAD figure.",
    scholarships:
      "Canada Domestic & Excellence Scholarship (25% for Canadian citizens/PRs, up to 50% with a 3.5+ GPA), College of Engineering Global Campus Scholarship (25% on select MS programs), 50% Career Advancement award for employer-partner staff, and the Double Husky alumni discount. Stackable to a 50% cap.",
    coopNote: "Embedded employer partnerships include:",
    employers: ["Amazon", "Google", "Deloitte"],
    website: "https://toronto.northeastern.edu/",
  },
  {
    key: "london",
    name: "London",
    region: "United Kingdom",
    images: ["/campuses/london-devon.jpg", "/campuses/london-devon-2.jpg"],
    location:
      "Devon House at St Katharine Docks, on the Thames beside Tower Bridge and the Tower of London.",
    programs: [
      "BSc Computer Science & Business",
      "BSc Business",
      "BSc Economics",
      "BA Culture, Technology & Global Challenges",
      "MSc programmes",
    ],
    offers:
      "Undergraduate degrees and MSc programs with a liberal-arts core, small seminar teaching, and the option to move between London and the U.S. campuses on the global network.",
    facilities:
      "Devon House's two floors mix a library, event space, and colorful common areas — undergrads can freely combine majors and minors across humanities, business, and tech.",
    tuition:
      "Set in pounds sterling by Northeastern University London — typically well below U.S. per-credit rates for comparable degrees.",
    scholarships:
      "International undergraduates are automatically considered for merit scholarships up to £3,000 (first year); international master's students have been offered awards around £3,900; and the NU London Bursary adds up to £5,000 per year for lower-income households.",
    coopNote:
      "Career services connect students into London's finance, creative, and tech job market, with the option to co-op back on a U.S. campus.",
    employers: [] as string[],
    website: "https://www.nulondon.ac.uk/",
  },
] as const;

type Campus = (typeof CAMPUSES)[number];

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

function Chip({ tone, children }: { tone: "program" | "employer"; children: React.ReactNode }) {
  return (
    <span
      className={
        "inline-block px-2.5 py-1 rounded-full font-mono text-[10.5px] tracking-wide " +
        (tone === "program"
          ? "bg-red-600/10 text-red-700 ring-1 ring-red-600/20"
          : "bg-[#12172a]/8 text-[#12172a]/75 ring-1 ring-[#12172a]/10")
      }
    >
      {children}
    </span>
  );
}

/** One campus: horizontal 2-panel slider — photo/name first, details on slide right. */
function CampusSlider({ campus }: { campus: Campus }) {
  const track = useRef<HTMLDivElement>(null);

  const slide = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section id={campus.key} className="scroll-mt-24">
      <div
        ref={track}
        className="no-scrollbar flex overflow-x-auto snap-x snap-mandatory rounded-[2rem] scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {/* Slide 1 — big photo + giant name */}
        <div className="relative min-w-full snap-start">
          <div className="relative h-[70vh] min-h-[26rem] rounded-[2rem] overflow-hidden">
            <Image
              src={campus.images[0]}
              alt={`${campus.name} campus`}
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <h2 className="absolute bottom-4 left-6 sm:left-10 text-[15vw] sm:text-[9rem] leading-none font-bold uppercase tracking-tighter text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)] pointer-events-none">
              {campus.name}
            </h2>
            <button
              onClick={() => slide(1)}
              aria-label={`Show ${campus.name} details`}
              className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-black/45 backdrop-blur-md ring-1 ring-white/25 rounded-full pl-4 pr-2 py-2 font-mono text-[11px] tracking-widest uppercase text-white hover:text-yellow-300 transition-colors"
            >
              Details
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-4 px-2 flex items-start gap-2 font-mono text-[11px] sm:text-xs tracking-[0.3em] uppercase text-slate-300">
            <MapPin className="w-4 h-4 text-red-500 shrink-0" />
            {campus.region} · {campus.location}
          </p>
        </div>

        {/* Slide 2 — detail cards */}
        <div className="relative min-w-full snap-start pl-4">
          <div className="grid sm:grid-cols-2 gap-4 h-[70vh] min-h-[26rem]">
            <div className="bg-[#ece9e0] text-[#12172a] rounded-[2rem] p-6 sm:p-7 flex flex-col overflow-y-auto">
              <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden mb-5 shrink-0">
                <Image
                  src={campus.images[1]}
                  alt={`${campus.name} campus life`}
                  fill
                  sizes="(min-width: 640px) 40vw, 90vw"
                  className="object-cover"
                />
              </div>

              <p className="font-mono text-[11px] tracking-widest uppercase text-[#12172a]/60 mb-2">
                Programs
              </p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {campus.programs.map((p) => (
                  <Chip key={p} tone="program">
                    {p}
                  </Chip>
                ))}
              </div>

              <p className="font-mono text-[11px] tracking-widest uppercase text-[#12172a]/60 mb-2">
                What it offers
              </p>
              <p className="text-sm sm:text-base leading-relaxed">{campus.offers}</p>

              <p className="font-mono text-[11px] tracking-widest uppercase text-[#12172a]/60 mt-5 mb-2">
                Campus &amp; facilities
              </p>
              <p className="text-sm sm:text-base leading-relaxed">{campus.facilities}</p>

              <ArrowDownRight className="w-6 h-6 mt-auto ml-auto pt-4 text-[#12172a]/70 shrink-0" />
            </div>

            <div className="bg-[#ece9e0] text-[#12172a] rounded-[2rem] p-6 sm:p-7 flex flex-col overflow-y-auto">
              <button
                onClick={() => slide(-1)}
                aria-label={`Back to ${campus.name} photo`}
                className="self-start flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase text-[#12172a]/60 hover:text-red-600 transition-colors mb-4"
              >
                <ChevronLeft className="w-4 h-4" />
                {campus.name}
              </button>

              <p className="font-mono text-[11px] tracking-widest uppercase text-[#12172a]/60 mb-2">
                Tuition
              </p>
              <p className="text-sm sm:text-base leading-relaxed">{campus.tuition}</p>

              <p className="font-mono text-[11px] tracking-widest uppercase text-[#12172a]/60 mt-5 mb-2">
                Scholarships &amp; aid
              </p>
              <p className="text-sm sm:text-base leading-relaxed">{campus.scholarships}</p>

              <p className="font-mono text-[11px] tracking-widest uppercase text-[#12172a]/60 mt-5 mb-2">
                Co-op &amp; industry ties
              </p>
              <p className="text-sm sm:text-base leading-relaxed">{campus.coopNote}</p>
              {campus.employers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {campus.employers.map((e) => (
                    <Chip key={e} tone="employer">
                      {e}
                    </Chip>
                  ))}
                </div>
              )}

              <a
                href={campus.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 self-start font-mono text-[11px] tracking-widest uppercase text-red-700 hover:text-red-600 transition-colors"
              >
                {campus.name} campus site
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <ArrowDownLeft className="w-6 h-6 mt-auto pt-4 text-[#12172a]/70 shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const heroImg = useRef<HTMLDivElement>(null);
  const heroDim = useRef<HTMLDivElement>(null);
  const heroText = useRef<HTMLDivElement>(null);
  const heroSection = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const update = () => {
      raf = 0;
      const section = heroSection.current;
      if (!section) return;
      const vh = window.innerHeight;
      const rect = section.getBoundingClientRect();
      const p = clamp(-rect.top / (rect.height - vh));

      if (heroImg.current && !reduceMotion) {
        heroImg.current.style.transform = `scale(${(1.04 + 0.28 * p).toFixed(4)})`;
      }
      if (heroDim.current) heroDim.current.style.opacity = (0.15 + 0.45 * p).toFixed(3);
      if (heroText.current) {
        const o = 1 - clamp((p - 0.55) / 0.35);
        heroText.current.style.opacity = o.toFixed(3);
        heroText.current.style.transform = reduceMotion
          ? "none"
          : `translateY(${((1 - o) * 36).toFixed(1)}px)`;
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <main className="bg-[#0b0f1e] text-white">
      {/* Hero — scroll-zoom */}
      <section ref={heroSection} className="relative h-[160vh]">
        <div className="sticky top-0 h-screen overflow-hidden">
          <div ref={heroImg} className="absolute inset-0 will-change-transform">
            <Image
              src="/campuses/boston.jpg"
              alt="Northeastern University, Boston"
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
          </div>
          <div ref={heroDim} className="absolute inset-0 bg-[#0b0f1e]" style={{ opacity: 0.15 }} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />

          <div
            ref={heroText}
            className="absolute inset-0 flex flex-col items-start justify-center px-6 sm:px-16 max-w-5xl"
          >
            <p className="font-mono text-xs sm:text-sm tracking-[0.35em] uppercase text-yellow-300 mb-4">
              Global Campus Network
            </p>
            <h1 className="text-5xl sm:text-7xl font-bold leading-[1.05] tracking-tight drop-shadow-lg">
              One university.
              <br />
              Six campuses.
              <br />
              <span className="text-red-500">Your journey starts here.</span>
            </h1>
            <p className="mt-6 max-w-xl text-slate-200 text-base sm:text-lg drop-shadow">
              Visas, arrival, billing, employment — an AI assistant grounded in
              Northeastern&apos;s own Office of Global Services documents, for every campus on
              the network.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Link
                href="/assistant"
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-sm tracking-widest uppercase px-6 py-3 rounded-full transition-colors shadow-[0_0_20px_rgba(220,38,38,0.6)]"
              >
                <MessageCircle className="w-4 h-4" />
                Ask the Assistant
              </Link>
              <span className="hidden sm:inline-flex items-center gap-2 font-mono text-xs tracking-widest uppercase text-slate-300">
                <ArrowDown className="w-4 h-4 animate-bounce" />
                Scroll to the campuses
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Campuses — dossier sliders */}
      <div id="campuses" className="scroll-mt-20 max-w-screen-xl mx-auto px-4 sm:px-6 pt-20 pb-28 space-y-20">
        <div>
          <p className="font-mono text-xs tracking-[0.35em] uppercase text-yellow-300 mb-4">
            Global Campus Network
          </p>
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tight max-w-3xl">
            Six campuses. <span className="text-red-500">One network.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-slate-300">
            Start in one city, finish in another, co-op in a third. Slide a campus to see what it
            offers, what it costs, and the scholarships on the table.
          </p>
        </div>

        {CAMPUSES.map((campus) => (
          <CampusSlider key={campus.key} campus={campus} />
        ))}

        <p className="font-mono text-[10px] tracking-widest uppercase text-slate-500">
          Tuition, scholarship, and program figures are indicative and change each academic year —
          confirm with Student Financial Services. Photography: Northeastern campus sites +
          Wikimedia Commons (public/campuses/ATTRIBUTION.md).
        </p>
      </div>

      {/* CTA */}
      <section className="border-t border-white/10 bg-[#0e1322]">
        <div className="max-w-screen-xl mx-auto px-6 py-20 flex flex-col items-center text-center">
          <p className="font-mono text-xs tracking-[0.35em] uppercase text-yellow-300 mb-4">
            Wherever you land
          </p>
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tight max-w-3xl">
            Nine expert guides. One husky. Zero confusion.
          </h2>
          <p className="mt-6 max-w-xl text-slate-300">
            Ask about F-1 visas, CPT/OPT, tuition, scholarships, arrival checklists and more —
            answers cite Northeastern&apos;s official documents, with a live northeastern.edu
            fallback when the paperwork runs out.
          </p>
          <Link
            href="/assistant"
            className="mt-10 inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-sm tracking-widest uppercase px-8 py-4 rounded-full transition-colors shadow-[0_0_20px_rgba(220,38,38,0.6)]"
          >
            <MessageCircle className="w-4 h-4" />
            Meet your guide
          </Link>
        </div>
      </section>
    </main>
  );
}
