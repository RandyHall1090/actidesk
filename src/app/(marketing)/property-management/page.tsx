import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ActiDeskCta } from "@/components/marketing/cta-button";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FaqSection } from "@/components/marketing/faq-section";

export const metadata: Metadata = {
  title: "ActiDesk for Property Management — Personalized Prospect Packages",
  description:
    "Give an owner or new tenant a reason to trust you before they walk in — a personalized, branded intro page built in minutes, with full tracking on what they open.",
};

const USE_CASES = [
  {
    heading: "Pitching a prospective property owner",
    body: "Introduce your management company with a video walkthrough of your process and a portfolio magazine, before the owner ever visits your office.",
  },
  {
    heading: "Welcoming a new tenant",
    body: "Send a personalized welcome package — a video from the property manager, move-in guide, and contact card — the day a lease is signed.",
  },
  {
    heading: "Renewing a relationship",
    body: "Before a renewal conversation, remind an owner or tenant what they get with a personalized recap package.",
  },
];

export default function PropertyManagementPage() {
  return (
    <>
      <section className="border-b border-steel-line/60 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono-brand text-xs uppercase tracking-[0.2em] text-electric">
            For Property Management
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-bone sm:text-5xl">
            Give an owner or new tenant a reason to trust you — before they walk in.
          </h1>
          <p className="mt-6 text-lg leading-8 text-bone-dim">
            ActiDesk lets a property manager build a personalized, branded intro page in
            minutes — a video message, your team&rsquo;s business card, a portfolio magazine,
            and a welcome letter, laid out on a photoreal desk-scene template — then shows
            exactly what they opened after you sent it.
          </p>
          <ActiDeskCta className="mt-8" />
        </div>
      </section>

      <section className="border-b border-steel-line/60 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="glow-frame relative mx-auto aspect-[1249/714] max-w-3xl overflow-hidden rounded-sm">
            <Image
              src="/images/property-management-desk-scene.png"
              alt="A real ActiDesk package built for a property management company — video message, business card, portfolio magazine, credentials, property photos, and a welcome pen, laid out on the desk-scene template"
              fill
              sizes="(min-width: 768px) 900px, 100vw"
              className="object-cover"
              priority
            />
          </div>
          <p className="mt-3 text-center text-xs text-bone-dim">
            An actual package built in ActiDesk — a property management company&rsquo;s own
            package uses their own branding, photos, and messaging.
          </p>

          <div className="glow-frame relative mx-auto mt-12 aspect-video max-w-2xl overflow-hidden rounded-sm">
            <iframe
              src="https://player.vimeo.com/video/1228647866?title=0&byline=0&portrait=0"
              title="The video message from the package above"
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="mt-3 text-center text-xs text-bone-dim">
            The video message from the package above — recorded once, sent to every prospect.
          </p>
        </div>
      </section>

      <section className="border-b border-steel-line/60 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl font-bold text-bone sm:text-4xl">
            How property managers use it
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {USE_CASES.map((item) => (
              <div key={item.heading}>
                <h3 className="font-display text-lg font-bold text-bone">{item.heading}</h3>
                <p className="mt-3 text-sm leading-6 text-bone-dim">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />
      <FaqSection />

      <section className="px-6 py-16 text-center">
        <ActiDeskCta />
        <p className="mt-6">
          <Link
            href="/"
            className="font-mono-brand text-xs uppercase tracking-wider text-electric hover:underline"
          >
            See how it works for every industry →
          </Link>
        </p>
      </section>
    </>
  );
}
