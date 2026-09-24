import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ActiDeskCta } from "@/components/marketing/cta-button";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FaqSection } from "@/components/marketing/faq-section";

export const metadata: Metadata = {
  title: "ActiDesk for Home Services & Contractors — Personalized Prospect Packages",
  description:
    "Give a homeowner a reason to book you over the next quote — a personalized, branded intro page built in minutes, with full tracking on what they open.",
};

const USE_CASES = [
  {
    heading: "Before an in-home estimate",
    body: "Send a homeowner a personalized package with your team, past work, and what to expect — before you ever knock on the door.",
  },
  {
    heading: "Following up a quote",
    body: "Stand out from every other contractor's PDF estimate with a branded package that shows your credentials and past projects.",
  },
  {
    heading: "When a referral comes in",
    body: "A referral partner sends you a lead — greet them with a personalized package before the first call, not after.",
  },
];

export default function HomeServicesPage() {
  return (
    <>
      <section className="border-b border-steel-line/60 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono-brand text-xs uppercase tracking-[0.2em] text-electric">
            For Home Services &amp; Contractors
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-bone sm:text-5xl">
            Give a homeowner a reason to book you — over the next quote.
          </h1>
          <p className="mt-6 text-lg leading-8 text-bone-dim">
            ActiDesk lets a contractor build a personalized, branded intro page in minutes — a
            video message, your business card, a project magazine, and a letter, laid out on a
            photoreal desk-scene template — then shows exactly what a homeowner opened after
            you sent it.
          </p>
          <ActiDeskCta className="mt-8" />
        </div>
      </section>

      <section className="border-b border-steel-line/60 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="glow-frame relative mx-auto aspect-[1249/714] max-w-3xl overflow-hidden rounded-sm">
            <Image
              src="/images/home-services-desk-scene.png"
              alt="A real ActiDesk package built for a home services contractor — video message, business card, project magazine, credentials, job photos, and a welcome pen, laid out on the desk-scene template"
              fill
              sizes="(min-width: 768px) 900px, 100vw"
              className="object-cover"
              priority
            />
          </div>
          <p className="mt-3 text-center text-xs text-bone-dim">
            An actual package built in ActiDesk — a contractor&rsquo;s own package uses their
            own branding, project photos, and messaging.
          </p>

          <div className="glow-frame relative mx-auto mt-12 aspect-video max-w-2xl overflow-hidden rounded-sm">
            <iframe
              src="https://player.vimeo.com/video/1228647867?title=0&byline=0&portrait=0"
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
            How contractors use it
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
