import Link from "next/link";
import type { Metadata } from "next";
import { ActiDeskCta } from "@/components/marketing/cta-button";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FaqSection } from "@/components/marketing/faq-section";

export const metadata: Metadata = {
  title: "ActiDesk — Personalized Prospect Packages for Any Sales Team",
  description:
    "Build a personalized, branded prospect page in minutes — video, audio, business card, magazine, and letter on a photoreal desk-scene template — then track exactly what a prospect opens.",
};

const INDUSTRIES = [
  {
    slug: "real-estate",
    label: "Real Estate",
    body: "Give a buyer or seller a reason to choose you before you ever meet.",
  },
  {
    slug: "property-management",
    label: "Property Management",
    body: "Give an owner or new tenant a reason to trust you before they walk in.",
  },
  {
    slug: "manufacturing",
    label: "Manufacturing",
    body: "Give a buyer a reason to remember your line before the follow-up call.",
  },
  {
    slug: "financial-services",
    label: "Financial Services",
    body: "Give a prospective client a reason to trust you before the first meeting.",
  },
  {
    slug: "home-services",
    label: "Home Services & Contractors",
    body: "Give a homeowner a reason to book you over the next quote.",
  },
];

const HOW_IT_WORKS = [
  {
    heading: "A branded, photoreal desk — not a plain list of links",
    body: "Modeled on the pre-meeting-materials format that already works, ActiDesk renders every package on a real desk-scene canvas — video, audio, business card, magazine, letter, and brochures laid on top — branded with the sending company's own logo and name, at a single URL a rep can drop straight into an email.",
  },
  {
    heading: "From a blank form to a sent link in minutes",
    body: "A rep enters the prospect's name, company, and email, picks or uploads a video, audio message, business card, and magazine feature from their own library or the shared company library, writes the letter, and chooses brochures — then gets a unique tracked URL to send themselves.",
  },
  {
    heading: "Know the moment it's opened — and what got a second look",
    body: 'Every page view and every asset open or play is logged and surfaced in a rep\'s "My Sites" list — no more sending a package into the void and hoping.',
  },
  {
    heading: "New: build packages straight from Outlook",
    body: "Each rep connects their own Outlook once, then starts a package directly from any of their Outlook contacts — no retyping a name or email. Personalize letters per contact with merge fields and list-merge an entire contact list at once, reviewing before send or letting it run. Outlook sends every message itself, from the rep's own mailbox — ActiDesk never sends prospect-facing email directly.",
  },
  {
    heading: "Your own account, walled off from every other organization on the platform",
    body: "ActiDesk is multi-tenant from the ground up — Securafy is the platform operator and its first customer, and every organization that licenses it gets a fully isolated workspace for its own reps to run their own outbound: its own reps, its own asset library, its own branding, never mixed with another licensee's data. A new work-email domain creates your organization automatically; a matching domain joins your teammates in as reps.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-steel-line/60 px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 sm:grid-cols-2 sm:items-center">
          <div>
            <p className="font-mono-brand text-xs uppercase tracking-[0.2em] text-electric">
              Any rep. Any industry.
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-bone sm:text-5xl">
              Give a prospect a reason to remember you — before the meeting starts.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-bone-dim">
              ActiDesk lets a rep build a personalized, branded prospect page in minutes —
              video, audio, business card, magazine feature, and a real letter, laid out on a
              photoreal desk-scene template — then tracks exactly what a prospect opens after
              the link is sent.
            </p>
            <ActiDeskCta className="mt-8" />
            <div className="mt-12 flex flex-wrap gap-8 border-t border-steel-line/60 pt-8">
              <div>
                <p className="font-display text-2xl font-bold text-bone">&lt;5 min</p>
                <p className="font-mono-brand text-xs uppercase tracking-wider text-bone-dim">
                  To build and send a package
                </p>
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-bone">Full</p>
                <p className="font-mono-brand text-xs uppercase tracking-wider text-bone-dim">
                  Per-tenant data isolation
                </p>
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-bone">NEW</p>
                <p className="font-mono-brand text-xs uppercase tracking-wider text-bone-dim">
                  Send straight from Outlook
                </p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="glow-frame relative aspect-video overflow-hidden rounded-sm">
              <iframe
                src="https://player.vimeo.com/video/1228145715?title=0&byline=0&portrait=0"
                title="ActiDesk — see a real package built, sent, and opened"
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-b border-steel-line/60 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl font-bold text-bone sm:text-4xl">How it works</h2>
          <div className="mt-12 grid gap-12">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.heading}>
                <h3 className="font-display text-xl font-bold text-bone">{item.heading}</h3>
                <p className="mt-3 max-w-2xl text-base leading-7 text-bone-dim">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="border-b border-steel-line/60 bg-steel/20 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono-brand text-xs uppercase tracking-[0.2em] text-electric">
            Built for how you sell
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold text-bone sm:text-4xl">
            One tool. Every outbound team.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {INDUSTRIES.map((industry) => (
              <Link
                key={industry.slug}
                href={`/${industry.slug}`}
                className="glow-frame block rounded-sm border border-steel-line bg-steel/40 p-6 transition hover:border-electric"
              >
                <h3 className="font-display text-lg font-bold text-bone">{industry.label}</h3>
                <p className="mt-2 text-sm leading-6 text-bone-dim">{industry.body}</p>
                <span className="mt-4 inline-block font-mono-brand text-xs uppercase tracking-wider text-electric">
                  See how it works →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />
      <FaqSection />

      <section className="px-6 py-16 text-center">
        <ActiDeskCta />
      </section>
    </>
  );
}
