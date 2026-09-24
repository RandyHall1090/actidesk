import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ActiDeskCta } from "@/components/marketing/cta-button";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FaqSection } from "@/components/marketing/faq-section";

export const metadata: Metadata = {
  title: "ActiDesk for Financial Services — Personalized Prospect Packages",
  description:
    "Give a prospective client a reason to trust you before the first meeting — a personalized, branded intro page built in minutes, with full tracking on what they open.",
};

const USE_CASES = [
  {
    heading: "Before a first client meeting",
    body: "Send a prospective client a personalized intro package with your background, credentials, and what to expect — before you ever sit down together.",
  },
  {
    heading: "After a referral introduction",
    body: "A referral partner sends you a lead — greet them with a personalized package before the first call, not after.",
  },
  {
    heading: "Ahead of a portfolio review",
    body: "Set the tone for an annual review with a personalized recap package that reminds a client what they get from working with you.",
  },
];

export default function FinancialServicesPage() {
  return (
    <>
      <section className="border-b border-steel-line/60 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono-brand text-xs uppercase tracking-[0.2em] text-electric">
            For Financial Services
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-bone sm:text-5xl">
            Give a prospective client a reason to trust you — before the first meeting.
          </h1>
          <p className="mt-6 text-lg leading-8 text-bone-dim">
            ActiDesk lets an advisor build a personalized, branded intro page in minutes — a
            video message, your business card, a credentials magazine, and a letter, laid out
            on a photoreal desk-scene template — then shows exactly what a prospect opened
            after you sent it.
          </p>
          <ActiDeskCta className="mt-8" />
        </div>
      </section>

      <section className="border-b border-steel-line/60 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="glow-frame relative mx-auto aspect-[1249/714] max-w-3xl overflow-hidden rounded-sm">
            <Image
              src="/images/financial-services-desk-scene.png"
              alt="A real ActiDesk package built for a financial advisor — video message, business card, credentials magazine, office photos, and a welcome pen, laid out on the desk-scene template"
              fill
              sizes="(min-width: 768px) 900px, 100vw"
              className="object-cover"
              priority
            />
          </div>
          <p className="mt-3 text-center text-xs text-bone-dim">
            An actual package built in ActiDesk — an advisor&rsquo;s own package uses their own
            branding, credentials, and messaging.
          </p>

          <div className="glow-frame relative mx-auto mt-12 aspect-video max-w-2xl overflow-hidden rounded-sm">
            <iframe
              src="https://player.vimeo.com/video/1228647869?title=0&byline=0&portrait=0"
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
            How advisors use it
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
